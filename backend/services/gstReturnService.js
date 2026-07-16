const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const ReturnInvoice = require('../models/ReturnInvoice');
const DebitCreditNote = require('../models/DebitCreditNote');
const GstReturnSnapshot = require('../models/GstReturnSnapshot');
const gstConfigService = require('./gstConfigService');
const {
  placeOfSupply, filingPeriodFp, periodBounds, stateCodeFromGstin,
} = require('../utils/gstDetermination');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * GST Return Engine — Sprint 4.3
 * Builds government-oriented JSON from transactional data.
 */
class GstReturnService {
  async _companyCtx(companyId) {
    const cfg = await gstConfigService.getOrCreate(companyId);
    return cfg;
  }

  async _salesInPeriod(companyId, startDate, endDate) {
    return Sales.find({
      companyId,
      status: { $ne: 'cancelled' },
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('customerId', 'name gstin state stateCode')
      .populate('items.itemId', 'name hsnCode gstRate')
      .lean();
  }

  async _purchasesInPeriod(companyId, startDate, endDate) {
    return Purchase.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('supplierId', 'name gstin state stateCode')
      .populate('items.itemId', 'name hsnCode gstRate')
      .lean();
  }

  async _returnsInPeriod(companyId, startDate, endDate) {
    return ReturnInvoice.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();
  }

  async _notesInPeriod(companyId, startDate, endDate) {
    return DebitCreditNote.find({
      companyId,
      status: 'Posted',
      date: { $gte: startDate, $lte: endDate },
    }).lean();
  }

  /**
   * GSTR-1 — B2B, B2CL, B2CS, CDNR, HSN, docs
   */
  async buildGstr1(companyId, period) {
    const cfg = await this._companyCtx(companyId);
    const { startDate, endDate } = periodBounds(period);
    const sales = await this._salesInPeriod(companyId, startDate, endDate);
    const returns = await this._returnsInPeriod(companyId, startDate, endDate);
    const notes = await this._notesInPeriod(companyId, startDate, endDate);

    const b2b = [];
    const b2cl = [];
    const b2csMap = {};
    const cdnr = [];
    const hsnMap = {};
    const companyPos = cfg.stateCode || stateCodeFromGstin(cfg.gstin);

    for (const s of sales) {
      const gstin = (s.customerId?.gstin || '').toUpperCase();
      const isRegistered = gstin.length === 15;
      const taxable = round2(s.taxableAmount);
      const cgst = round2(s.cgst);
      const sgst = round2(s.sgst);
      const igst = round2(s.igst);
      const pos = placeOfSupply({
        partyGstin: gstin,
        partyStateCode: s.customerId?.stateCode,
        companyStateCode: companyPos,
      }).stateCode || companyPos;

      const inv = {
        inum: s.invoiceNo,
        idt: s.date ? new Date(s.date).toISOString().slice(0, 10) : '',
        val: round2(s.netAmount),
        pos,
        rchrg: s.reverseCharge ? 'Y' : 'N',
        inv_typ: s.gstType === 'Export' || s.gstType === 'ZeroRated' ? 'SEWP' : 'R',
        itms: [{
          num: 1,
          itm_det: {
            txval: taxable,
            rt: s.gstRate || (taxable ? round2(((cgst + sgst + igst) / taxable) * 100) : 0),
            iamt: igst,
            camt: cgst,
            samt: sgst,
            csamt: round2(s.cess || 0),
          },
        }],
      };

      if (isRegistered) {
        let party = b2b.find((x) => x.ctin === gstin);
        if (!party) {
          party = { ctin: gstin, inv: [] };
          b2b.push(party);
        }
        party.inv.push(inv);
      } else if (taxable > 250000 && igst > 0) {
        b2cl.push(inv);
      } else {
        const rate = inv.itms[0].itm_det.rt;
        const key = `${pos}|${rate}`;
        if (!b2csMap[key]) {
          b2csMap[key] = {
            sply_ty: igst > 0 ? 'INTER' : 'INTRA',
            pos,
            typ: 'OE',
            rt: rate,
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0,
          };
        }
        b2csMap[key].txval = round2(b2csMap[key].txval + taxable);
        b2csMap[key].iamt = round2(b2csMap[key].iamt + igst);
        b2csMap[key].camt = round2(b2csMap[key].camt + cgst);
        b2csMap[key].samt = round2(b2csMap[key].samt + sgst);
      }

      for (const line of s.items || []) {
        const hsn = line.itemId?.hsnCode || line.hsnCode || '';
        if (!hsn) continue;
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            num: Object.keys(hsnMap).length + 1,
            hsn_sc: hsn,
            desc: line.itemId?.name || '',
            uqc: 'MTR',
            qty: 0,
            rt: line.itemId?.gstRate || s.gstRate || 0,
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0,
          };
        }
        const lineTaxable = round2(line.amount || (line.mts || 0) * (line.rate || 0));
        const rt = (hsnMap[hsn].rt || 0) / 100;
        hsnMap[hsn].qty = round2(hsnMap[hsn].qty + (line.mts || line.qty || 0));
        hsnMap[hsn].txval = round2(hsnMap[hsn].txval + lineTaxable);
        if (igst > 0) hsnMap[hsn].iamt = round2(hsnMap[hsn].iamt + lineTaxable * rt);
        else {
          hsnMap[hsn].camt = round2(hsnMap[hsn].camt + (lineTaxable * rt) / 2);
          hsnMap[hsn].samt = round2(hsnMap[hsn].samt + (lineTaxable * rt) / 2);
        }
      }
    }

    // Credit / Debit notes → CDNR
    for (const n of notes) {
      if (!n.taxableAmount && !n.amount) continue;
      cdnr.push({
        ntty: n.noteType === 'Credit' ? 'C' : 'D',
        nt_num: n.noteNo,
        nt_dt: n.date ? new Date(n.date).toISOString().slice(0, 10) : '',
        val: round2(n.netAmount || n.amount),
        txval: round2(n.taxableAmount || n.amount),
        iamt: round2(n.igst || 0),
        camt: round2(n.cgst || 0),
        samt: round2(n.sgst || 0),
        rsn: n.reason || '',
      });
    }

    for (const r of returns) {
      if (r.returnType !== 'Sales') continue;
      cdnr.push({
        ntty: 'C',
        nt_num: r.invoiceNo || r.returnNo,
        nt_dt: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
        val: round2(r.netAmount),
        txval: round2(r.taxableAmount),
        iamt: round2(r.igst || 0),
        camt: round2(r.cgst || (r.gstAmount || 0) / 2),
        samt: round2(r.sgst || (r.gstAmount || 0) / 2),
        rsn: 'Sales Return',
      });
    }

    const payload = {
      gstin: cfg.gstin,
      fp: filingPeriodFp(period),
      version: 'GST3.2.2',
      hash: '',
      b2b,
      b2cl,
      b2cs: Object.values(b2csMap),
      cdnr: cdnr.length ? [{ nt: cdnr }] : [],
      hsn: { data: Object.values(hsnMap) },
      doc_issue: {
        doc_det: [{
          doc_num: 1,
          docs: [{
            num: 1,
            from: sales[0]?.invoiceNo || '',
            to: sales[sales.length - 1]?.invoiceNo || '',
            totnum: sales.length,
            cancel: 0,
            net_issue: sales.length,
          }],
        }],
      },
    };

    const totals = {
      taxable: round2(sales.reduce((s, x) => s + (x.taxableAmount || 0), 0)),
      cgst: round2(sales.reduce((s, x) => s + (x.cgst || 0), 0)),
      sgst: round2(sales.reduce((s, x) => s + (x.sgst || 0), 0)),
      igst: round2(sales.reduce((s, x) => s + (x.igst || 0), 0)),
      invoiceCount: sales.length,
    };

    return { payload, totals, period };
  }

  /**
   * GSTR-3B summary from books
   */
  async buildGstr3b(companyId, period) {
    const cfg = await this._companyCtx(companyId);
    const { startDate, endDate } = periodBounds(period);
    const sales = await this._salesInPeriod(companyId, startDate, endDate);
    const purchases = await this._purchasesInPeriod(companyId, startDate, endDate);

    const outward = {
      taxable: round2(sales.reduce((s, x) => s + (x.taxableAmount || 0), 0)),
      cgst: round2(sales.reduce((s, x) => s + (x.cgst || 0), 0)),
      sgst: round2(sales.reduce((s, x) => s + (x.sgst || 0), 0)),
      igst: round2(sales.reduce((s, x) => s + (x.igst || 0), 0)),
      cess: round2(sales.reduce((s, x) => s + (x.cess || 0), 0)),
    };

    const inward = {
      taxable: round2(purchases.reduce((s, x) => s + (x.taxableAmount || 0), 0)),
      cgst: round2(purchases.reduce((s, x) => s + (x.cgst || 0), 0)),
      sgst: round2(purchases.reduce((s, x) => s + (x.sgst || 0), 0)),
      igst: round2(purchases.reduce((s, x) => s + (x.igst || 0), 0)),
      cess: round2(purchases.reduce((s, x) => s + (x.cess || 0), 0)),
    };

    const rcm = purchases.filter((p) => p.reverseCharge === 'Yes' || p.reverseCharge === true || p.rcmCharge);
    const rcmTax = {
      cgst: round2(rcm.reduce((s, x) => s + (x.cgst || 0), 0)),
      sgst: round2(rcm.reduce((s, x) => s + (x.sgst || 0), 0)),
      igst: round2(rcm.reduce((s, x) => s + (x.igst || 0), 0)),
    };

    const itcAvailable = {
      cgst: inward.cgst,
      sgst: inward.sgst,
      igst: inward.igst,
      cess: inward.cess,
    };

    const netPayable = {
      cgst: round2(outward.cgst + rcmTax.cgst - itcAvailable.cgst),
      sgst: round2(outward.sgst + rcmTax.sgst - itcAvailable.sgst),
      igst: round2(outward.igst + rcmTax.igst - itcAvailable.igst),
      cess: round2(outward.cess - itcAvailable.cess),
    };

    const payload = {
      gstin: cfg.gstin,
      ret_period: filingPeriodFp(period),
      sup_details: {
        osup_det: {
          txval: outward.taxable,
          iamt: outward.igst,
          camt: outward.cgst,
          samt: outward.sgst,
          csamt: outward.cess,
        },
        osup_zero: { txval: 0, iamt: 0, csamt: 0 },
        osup_nil_exmp: { txval: 0 },
        isup_rev: {
          txval: round2(rcm.reduce((s, x) => s + (x.taxableAmount || 0), 0)),
          iamt: rcmTax.igst,
          camt: rcmTax.cgst,
          samt: rcmTax.sgst,
          csamt: 0,
        },
      },
      inter_sup: {},
      itc_elg: {
        itc_avl: [{
          ty: 'IMPG',
          iamt: itcAvailable.igst,
          camt: itcAvailable.cgst,
          samt: itcAvailable.sgst,
          csamt: itcAvailable.cess,
        }],
      },
      inward_sup: {
        isup_details: [{
          ty: 'GST',
          inter: inward.igst > 0 ? inward.taxable : 0,
          intra: inward.igst > 0 ? 0 : inward.taxable,
        }],
      },
      tx_pmt: {
        tx_py: [
          { tran_desc: 'Central Tax', tax_pay: Math.max(0, netPayable.cgst) },
          { tran_desc: 'State Tax', tax_pay: Math.max(0, netPayable.sgst) },
          { tran_desc: 'Integrated Tax', tax_pay: Math.max(0, netPayable.igst) },
        ],
      },
      netPayable,
      outward,
      inward,
    };

    return {
      payload,
      totals: {
        taxable: outward.taxable,
        cgst: netPayable.cgst,
        sgst: netPayable.sgst,
        igst: netPayable.igst,
        invoiceCount: sales.length,
      },
      period,
    };
  }

  /** GSTR-9 annual roll-up (ready structure) */
  async buildGstr9(companyId, financialYear) {
    // FY Apr–Mar: 2025-26 → periods 2025-04 … 2026-03
    const [startY] = financialYear.split('-').map((x) => parseInt(x, 10));
    const yearStart = startY > 2000 ? startY : 2000 + startY;
    const months = [];
    for (let m = 4; m <= 12; m++) months.push(`${yearStart}-${String(m).padStart(2, '0')}`);
    for (let m = 1; m <= 3; m++) months.push(`${yearStart + 1}-${String(m).padStart(2, '0')}`);

    const monthly = [];
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    for (const period of months) {
      const g1 = await this.buildGstr1(companyId, period);
      monthly.push({ period, totals: g1.totals });
      taxable += g1.totals.taxable;
      cgst += g1.totals.cgst;
      sgst += g1.totals.sgst;
      igst += g1.totals.igst;
    }

    const cfg = await this._companyCtx(companyId);
    return {
      payload: {
        gstin: cfg.gstin,
        financialYear,
        table4: { taxable: round2(taxable), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst) },
        monthly,
        gstr9cReady: true,
      },
      totals: { taxable: round2(taxable), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst) },
      period: financialYear,
    };
  }

  async snapshot(companyId, returnType, periodOrFy, userId) {
    let built;
    if (returnType === 'GSTR1') built = await this.buildGstr1(companyId, periodOrFy);
    else if (returnType === 'GSTR3B') built = await this.buildGstr3b(companyId, periodOrFy);
    else if (returnType === 'GSTR9') built = await this.buildGstr9(companyId, periodOrFy);
    else throw new Error(`Unsupported return type ${returnType}`);

    const last = await GstReturnSnapshot.findOne({
      companyId, period: periodOrFy, returnType,
    }).sort({ version: -1 });

    const version = (last?.version || 0) + 1;
    if (last && last.status === 'Final') {
      last.status = 'Superseded';
      await last.save();
    }

    const snap = await GstReturnSnapshot.create({
      companyId,
      period: periodOrFy,
      returnType,
      version,
      payload: built.payload,
      totals: built.totals,
      status: 'Final',
      generatedBy: userId,
      generatedAt: new Date(),
    });

    // Update period status
    if (returnType === 'GSTR1' || returnType === 'GSTR3B') {
      const p = await gstConfigService.ensurePeriod(companyId, periodOrFy);
      if (returnType === 'GSTR1') p.gstr1Status = 'Generated';
      if (returnType === 'GSTR3B') p.gstr3bStatus = 'Generated';
      await p.save();
    }

    await auditService.logSystem({
      companyId, userId, action: 'GST_RETURN_GENERATE', module: returnType,
      referenceId: snap._id, after: { period: periodOrFy, version, totals: built.totals },
    });

    return snap;
  }

  async exportJson(companyId, returnType, period) {
    const snap = await GstReturnSnapshot.findOne({
      companyId, returnType, period, status: { $in: ['Final', 'Filed'] },
    }).sort({ version: -1 });
    if (snap) return snap.payload;

    if (returnType === 'GSTR1') return (await this.buildGstr1(companyId, period)).payload;
    if (returnType === 'GSTR3B') return (await this.buildGstr3b(companyId, period)).payload;
    if (returnType === 'GSTR9') return (await this.buildGstr9(companyId, period)).payload;
    throw new Error('Nothing to export');
  }
}

module.exports = new GstReturnService();
