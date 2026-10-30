const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const ReturnInvoice = require('../models/ReturnInvoice');
const DebitCreditNote = require('../models/DebitCreditNote');
const GstReturnSnapshot = require('../models/GstReturnSnapshot');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Company = require('../models/Company');
const gstConfigService = require('./gstConfigService');
const {
  placeOfSupply, filingPeriodFp, periodBounds, stateCodeFromGstin, b2clThreshold,
} = require('../utils/gstDetermination');
const auditService = require('./auditService');
const {
  allocateInvoiceLines, groupByRate, buildDocSeries, uqcLabel,
} = require('../utils/gstr1Lines');

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
      isDeleted: { $ne: true },
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('customerId', 'name gstin state stateCode')
      .populate('items.itemId', 'name hsnCode gstRate')
      .lean();
  }

  async _purchasesInPeriod(companyId, startDate, endDate) {
    return Purchase.find({
      companyId,
      status: { $ne: 'cancelled' },
      isDeleted: { $ne: true },
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('supplierId', 'name gstin state stateCode')
      .populate('items.itemId', 'name hsnCode gstRate')
      .lean();
  }

  /**
   * Inward GST that is not a purchase bill, as JSM's JSM_VW_GST_PURCHASE_ALL adds it to GSTR-3B ITC: mill (process)
   * and job work bills, and expense entries with GST (JSM GST journal 'E'). Shaped like purchases for the 3B sums.
   */
  async _otherInwardInPeriod(companyId, startDate, endDate) {
    const Job = require('../models/Job');
    const DebitCreditNote = require('../models/DebitCreditNote');
    const inRange = { $gte: startDate, $lte: endDate };
    const [jobs, expenses] = await Promise.all([
      Job.find({
        companyId, status: { $ne: 'Cancelled' }, isDeleted: { $ne: true }, processGstAmount: { $gt: 0 },
        $or: [{ processBillDate: inRange }, { processBillDate: null, receiveDate: inRange }],
      }).lean(),
      DebitCreditNote.find({ companyId, expInc: 'E', status: { $ne: 'cancelled' }, isDeleted: { $ne: true }, date: inRange }).lean(),
    ]);
    const rows = jobs.map((j) => {
      let cgst = Number(j.processCgst || 0); let sgst = Number(j.processSgst || 0); let igst = Number(j.processIgst || 0);
      if (!(cgst || sgst || igst)) {
        const gst = Number(j.processGstAmount || 0);
        if (String(j.gstType || '').toUpperCase().includes('IGST')) igst = gst;
        else { cgst = round2(gst / 2); sgst = round2(gst - cgst); }
      }
      const jobWork = j.workKind === 'Job' || (!j.workKind && j.processType === 'Job Work');
      return { source: jobWork ? 'JobWork' : 'Mill', taxableAmount: Number(j.processCharges || 0), cgst, sgst, igst, cess: 0, itcEligibility: 'Input services', reverseCharge: 'No' };
    });
    for (const n of expenses) {
      rows.push({ source: 'Expense', taxableAmount: Number(n.taxableAmount || 0), cgst: Number(n.cgst || 0), sgst: Number(n.sgst || 0), igst: Number(n.igst || 0), cess: Number(n.cess || 0), itcEligibility: 'Input services', reverseCharge: 'No' });
    }
    return rows;
  }

  async _cancelledSalesInPeriod(companyId, startDate, endDate) {
    return Sales.find({
      companyId,
      status: 'cancelled',
      isDeleted: { $ne: true },
      date: { $gte: startDate, $lte: endDate },
    })
      .select('invoiceNo date bookId')
      .lean();
  }

  async _returnsInPeriod(companyId, startDate, endDate) {
    return ReturnInvoice.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('partyId', 'name gstin stateCode')
      .lean();
  }

  /**
   * @param {'Sales'|'Purchase'} side which book's notes to return.
   * GSTR-1 is an outward-supply return, so only Sales-side notes may appear in it —
   * purchase-side notes adjust ITC and belong to the inward side. Legacy rows have no
   * noteSide, and for those the old controller's mapping was Credit→Sales, Debit→Purchase.
   */
  async _notesInPeriod(companyId, startDate, endDate, side = 'Sales') {
    const legacyType = side === 'Sales' ? 'Credit' : 'Debit';
    return DebitCreditNote.find({
      companyId,
      status: 'Posted',
      date: { $gte: startDate, $lte: endDate },
      $or: [
        { noteSide: side },
        { noteSide: { $exists: false }, noteType: legacyType },
        { noteSide: null, noteType: legacyType },
      ],
    })
      .populate({
        path: 'partyLedgerId',
        select: 'name linkedPartyId',
        populate: { path: 'linkedPartyId', select: 'gstin name stateCode' },
      })
      .lean();
  }

  _isImportPurchase(p) {
    const type = String(p.type || '').toUpperCase();
    const itc = String(p.itcEligibility || '').toUpperCase();
    const gstType = String(p.gstType || '').toUpperCase();
    if (itc.includes('IMPS') || type.includes('IMPORT SERVICE') || type === 'IMPS') return 'IMPS';
    if (
      itc.includes('IMPG')
      || itc.includes('IMPORT')
      || type.includes('IMPORT')
      || type === 'IMPG'
      || gstType === 'IMPORT'
    ) return 'IMPG';
    return 'OTH';
  }

  /**
   * GSTR-1 — B2B, B2CL, B2CS, CDNR, HSN, docs
   */
  /**
   * @param {object} [range] Optional explicit {startDate, endDate} that overrides the
   *   month derived from `period`. A GST RETURN is always filed for one month, so `period`
   *   remains the filing identity (fp/version in the payload); this override exists only
   *   so the on-screen report can honour an arbitrary From/To range the user picked.
   *   Without it, a multi-month range silently collapsed to a single month on the sales
   *   side while purchases used the full range — the two halves of the same report were
   *   then measuring different windows.
   */
  async buildGstr1(companyId, period, range = null) {
    const cfg = await this._companyCtx(companyId);
    const bounds = periodBounds(period);
    const startDate = range?.startDate ? new Date(range.startDate) : bounds.startDate;
    const endDate = range?.endDate ? new Date(range.endDate) : bounds.endDate;
    if (range?.endDate) endDate.setHours(23, 59, 59, 999);
    const sales = await this._salesInPeriod(companyId, startDate, endDate);
    const cancelledSales = await this._cancelledSalesInPeriod(companyId, startDate, endDate);
    const returns = await this._returnsInPeriod(companyId, startDate, endDate);
    // Sales-side only — purchase notes adjust ITC and must never be filed as outward supply.
    const notes = await this._notesInPeriod(companyId, startDate, endDate, 'Sales');

    const b2b = [];
    const b2bRows = [];
    const b2cl = [];
    const b2clRows = [];
    const b2csMap = {};
    const cdnrByCtin = {};
    const cdnrRows = [];
    const cdnuRows = [];
    const hsnMap = {};
    const hsnB2bMap = {};
    const hsnB2cMap = {};
    const expRows = [];
    const exempMap = {
      interReg: { desc: 'Inter-State supplies to registered persons', nil: 0, exempt: 0, nonGst: 0 },
      intraReg: { desc: 'Intra-State supplies to registered persons', nil: 0, exempt: 0, nonGst: 0 },
      interUnreg: { desc: 'Inter-State supplies to unregistered persons', nil: 0, exempt: 0, nonGst: 0 },
      intraUnreg: { desc: 'Intra-State supplies to unregistered persons', nil: 0, exempt: 0, nonGst: 0 },
    };

    const companyPos = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';
    const { stateNameFromCode } = require('../utils/gstDetermination');

    const pushCdnr = (ctin, cname, note) => {
      const key = (ctin || '').toUpperCase() || '_UNREG';
      if (!cdnrByCtin[key]) cdnrByCtin[key] = { ctin: key === '_UNREG' ? '' : key, cname: cname || '', nt: [] };
      cdnrByCtin[key].nt.push(note);
    };

    /**
     * Portal expects rate-wise itms. Rows come from the invoice lines at each line's own GST rate,
     * so a 5% + 18% bill files as two rate rows (as JSM does) and sum(itms) equals the saved tax.
     */
    const buildRateWiseItms = (allocated) => groupByRate(allocated).map((g, idx) => ({
      num: idx + 1,
      itm_det: {
        txval: g.txval, rt: g.rt, iamt: g.iamt, camt: g.camt, samt: g.samt, csamt: g.csamt,
      },
    }));

    for (const s of sales) {
      const gstin = (s.customerId?.gstin || '').toUpperCase();
      const partyName = s.customerId?.name || s.partyName || 'Cash Sale';
      const isRegistered = gstin.length === 15;
      const taxable = round2(s.taxableAmount);
      const cgst = round2(s.cgst);
      const sgst = round2(s.sgst);
      const igst = round2(s.igst);
      const cess = round2(s.cess || 0);
      const tcs = Number(s.tcsAmount || s.tcs || 0);
      const rawNet = Number(s.netAmount);
      const fallbackVal = taxable + cgst + sgst + igst + cess + Number(s.roundOff || 0);
      const invVal = round2(Number.isFinite(rawNet) && rawNet > 0 ? Math.max(0, rawNet - tcs) : fallbackVal);
      const posCode = placeOfSupply({
        partyGstin: gstin,
        partyStateCode: s.customerId?.stateCode,
        companyStateCode: companyPos,
      }).stateCode || companyPos;
      const stateName = stateNameFromCode(posCode) || s.customerId?.state || '';
      const posFullName = `${posCode}${stateName ? `-${stateName}` : ''}`;
      const isInterState = igst > 0 || (posCode && posCode !== companyPos);
      const taxRate = s.gstRate || (taxable ? round2(((cgst + sgst + igst) / taxable) * 100) : 0);
      const invDate = s.date ? new Date(s.date).toISOString().slice(0, 10) : '';

      // Check for Export supply
      if (s.gstType === 'Export' || s.gstType === 'ZeroRated' || posCode === '97') {
        const expType = igst > 0 ? 'WPAY' : 'WOPAY';
        expRows.push({
          exportType: expType,
          invoiceNo: s.invoiceNo,
          date: invDate,
          invoiceValue: invVal,
          portCode: s.portCode || '',
          shippingBillNo: s.shippingBillNo || '',
          shippingBillDate: s.shippingBillDate ? new Date(s.shippingBillDate).toISOString().slice(0, 10) : '',
          taxRate,
          taxableAmount: taxable,
          igst,
          cess,
        });
        continue;
      }

      // Exempt / Nil / Non-GST → Table 8 only (never also B2B/B2CL/B2CS)
      if (s.gstType === 'Exempt' || s.gstType === 'NilRated' || s.gstType === 'NonGST' || (taxable > 0 && taxRate === 0 && cgst === 0 && sgst === 0 && igst === 0)) {
        const bucket = isInterState
          ? (isRegistered ? 'interReg' : 'interUnreg')
          : (isRegistered ? 'intraReg' : 'intraUnreg');
        if (s.gstType === 'NonGST') exempMap[bucket].nonGst = round2(exempMap[bucket].nonGst + taxable);
        else if (s.gstType === 'Exempt') exempMap[bucket].exempt = round2(exempMap[bucket].exempt + taxable);
        else exempMap[bucket].nil = round2(exempMap[bucket].nil + taxable);
        continue;
      }

      const allocated = allocateInvoiceLines(s, {
        taxable, taxRate, cgst, sgst, igst, cess,
      });
      const rateRows = groupByRate(allocated);

      const inv = {
        inum: s.invoiceNo,
        idt: invDate,
        val: invVal,
        pos: posCode,
        pos_name: posFullName,
        party_name: partyName,
        rchrg: s.reverseCharge ? 'Y' : 'N',
        inv_typ: 'R',
        itms: buildRateWiseItms(allocated),
      };

      if (isRegistered) {
        let party = b2b.find((x) => x.ctin === gstin);
        if (!party) {
          party = { ctin: gstin, cname: partyName, inv: [] };
          b2b.push(party);
        }
        party.inv.push(inv);

        for (const g of rateRows) {
          b2bRows.push({
            gstin,
            partyName,
            invoiceNo: s.invoiceNo,
            date: invDate,
            netAmount: invVal,
            stateName: posFullName,
            reverseCharge: s.reverseCharge ? 'Y' : 'N',
            taxRate: `${g.rt.toFixed(2)}%`,
            invType: 'Regular',
            taxableAmount: g.txval,
            cgst: g.camt,
            sgst: g.samt,
            igst: g.iamt,
            cess: g.csamt,
          });
        }
      } else if (invVal > b2clThreshold(s.date) && isInterState) {
        // B2CL — large interstate unregistered
        b2cl.push({ ...inv, val: invVal });
        for (const g of rateRows) {
          b2clRows.push({
            invoiceNo: s.invoiceNo,
            date: invDate,
            netAmount: invVal,
            stateName: posFullName,
            taxRate: g.rt.toFixed(2),
            taxableAmount: g.txval,
            cess: g.csamt,
            ecomm: s.ecommGstin || '',
            igst: g.iamt,
          });
        }
      } else {
        // B2CS — small unregistered, one row per place-of-supply + line rate
        for (const g of rateRows) {
          const rateStr = Number(g.rt || 0).toFixed(2);
          const key = `${posFullName}|${rateStr}`;
          if (!b2csMap[key]) {
            b2csMap[key] = {
              sply_ty: isInterState ? 'INTER' : 'INTRA',
              pos: posCode,
              pos_name: posFullName,
              typ: 'OE',
              app_rate: '',
              rt: rateStr,
              txval: 0,
              iamt: 0,
              camt: 0,
              samt: 0,
              csamt: 0,
              ecomm: '',
            };
          }
          b2csMap[key].txval = round2(b2csMap[key].txval + g.txval);
          b2csMap[key].iamt = round2(b2csMap[key].iamt + g.iamt);
          b2csMap[key].camt = round2(b2csMap[key].camt + g.camt);
          b2csMap[key].samt = round2(b2csMap[key].samt + g.samt);
          b2csMap[key].csamt = round2(b2csMap[key].csamt + g.csamt);
        }
      }

      // HSN (Table 12): one row per HSN + UQC + rate, from line taxable and the saved line tax
      for (const r of allocated) {
        const rtStr = Number(r.rate || 0).toFixed(2);
        const key = `${r.hsn}|${r.uqc}|${rtStr}`;
        const accumulateHsn = (targetMap) => {
          if (!targetMap[key]) {
            targetMap[key] = {
              num: Object.keys(targetMap).length + 1,
              hsn_sc: r.hsn,
              desc: r.desc,
              uqc: r.uqc,
              uqcDesc: uqcLabel(r.uqc),
              qty: 0,
              val: 0,
              rt: rtStr,
              txval: 0,
              iamt: 0,
              camt: 0,
              samt: 0,
              csamt: 0,
            };
          }
          const h = targetMap[key];
          h.qty = round2(h.qty + r.qty);
          h.txval = round2(h.txval + r.txval);
          h.iamt = round2(h.iamt + r.iamt);
          h.camt = round2(h.camt + r.camt);
          h.samt = round2(h.samt + r.samt);
          h.csamt = round2(h.csamt + r.csamt);
          h.val = round2(h.val + r.txval + r.iamt + r.camt + r.samt + r.csamt);
        };
        accumulateHsn(hsnMap);
        accumulateHsn(isRegistered ? hsnB2bMap : hsnB2cMap);
      }
    }

    // Credit / Debit notes → CDNR / CDNU
    for (const n of notes) {
      if (!n.taxableAmount && !n.amount) continue;
      const ctin = (
        n.partyLedgerId?.linkedPartyId?.gstin
        || n.partyGstin
        || n.ctin
        || ''
      ).toUpperCase();
      const partyName = n.partyLedgerId?.name || n.partyName || '';
      const noteDate = n.date ? new Date(n.date).toISOString().slice(0, 10) : '';
      const posCode = String(n.placeOfSupply || '').match(/^d{2}/)?.[0]
        || placeOfSupply({
          partyGstin: ctin,
          partyStateCode: n.partyLedgerId?.linkedPartyId?.stateCode,
          companyStateCode: companyPos,
        }).stateCode
        || companyPos;
      const stateName = stateNameFromCode(posCode) || '';
      const posFullName = `${posCode}${stateName ? `-${stateName}` : ''}`;
      const noteVal = round2(n.netAmount || n.amount);
      const noteTaxable = round2(n.taxableAmount || n.amount);
      const noteType = n.noteType === 'Credit' ? 'C' : 'D';
      const taxRate = n.gstRate ?? (noteTaxable ? round2((((n.cgst || 0) + (n.sgst || 0) + (n.igst || 0)) / noteTaxable) * 100) : 0);

      if (ctin && ctin.length === 15) {
        pushCdnr(ctin, partyName, {
          ntty: noteType,
          nt_num: n.noteNo,
          nt_dt: noteDate,
          val: noteVal,
          txval: noteTaxable,
          iamt: round2(n.igst || 0),
          camt: round2(n.cgst || 0),
          samt: round2(n.sgst || 0),
          csamt: round2(n.cess || 0),
          rsn: n.reason || 'Correction in Invoice',
          p_gst: 'N',
          pos: posCode,
          pos_name: posFullName,
          rt: taxRate.toFixed(2),
        });

        cdnrRows.push({
          gstin: ctin,
          partyName,
          noteNo: n.noteNo,
          noteDate,
          noteType,
          pos: posFullName,
          netAmount: noteVal,
          taxRate: `${taxRate.toFixed(2)}%`,
          taxableAmount: noteTaxable,
          cgst: round2(n.cgst || 0),
          sgst: round2(n.sgst || 0),
          igst: round2(n.igst || 0),
          cess: round2(n.cess || 0),
          reason: n.reason || 'Correction',
        });
      } else {
        cdnuRows.push({
          type: noteVal > b2clThreshold(n.date) ? 'B2CL' : 'B2CS',
          noteNo: n.noteNo,
          noteDate,
          noteType,
          pos: posFullName,
          taxRate: taxRate.toFixed(2),
          taxableAmount: noteTaxable,
          netAmount: noteVal,
          cgst: round2(n.cgst || 0),
          sgst: round2(n.sgst || 0),
          igst: round2(n.igst || 0),
          reason: n.reason || 'Correction',
        });
      }
    }

    for (const r of returns) {
      if (r.returnType !== 'Sales') continue;
      const ctin = (r.partyId?.gstin || r.partyGstin || '').toUpperCase();
      const partyName = r.partyId?.name || r.partyName || '';
      const retDate = r.date ? new Date(r.date).toISOString().slice(0, 10) : '';
      const posCode = placeOfSupply({
        partyGstin: ctin,
        partyStateCode: r.partyId?.stateCode,
        companyStateCode: companyPos,
      }).stateCode || companyPos;
      const stateName = stateNameFromCode(posCode) || '';
      const posFullName = `${posCode}${stateName ? `-${stateName}` : ''}`;
      const retTcs = Number(r.tcsAmount || r.tcs || 0);
      const rawRetNet = Number(r.netAmount);
      const retTaxable = round2(r.taxableAmount);
      const fallbackRetVal = retTaxable + Number(r.cgst || 0) + Number(r.sgst || 0) + Number(r.igst || 0) + Number(r.roundOff || 0);
      const retVal = round2(Number.isFinite(rawRetNet) && rawRetNet > 0 ? Math.max(0, rawRetNet - retTcs) : fallbackRetVal);
      const taxRate = retTaxable ? round2((((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0)) / retTaxable) * 100) : 0;

      if (ctin && ctin.length === 15) {
        pushCdnr(ctin, partyName, {
          ntty: 'C',
          nt_num: r.invoiceNo || r.returnNo,
          nt_dt: retDate,
          val: retVal,
          txval: retTaxable,
          iamt: round2(r.igst || 0),
          camt: round2(r.cgst || (r.gstAmount || 0) / 2),
          samt: round2(r.sgst || (r.gstAmount || 0) / 2),
          csamt: 0,
          rsn: 'Sales Return',
          p_gst: 'N',
          pos: posCode,
          pos_name: posFullName,
          rt: taxRate.toFixed(2),
        });

        cdnrRows.push({
          gstin: ctin,
          partyName,
          noteNo: r.invoiceNo || r.returnNo,
          noteDate: retDate,
          noteType: 'C',
          pos: posFullName,
          netAmount: retVal,
          taxRate: `${taxRate.toFixed(2)}%`,
          taxableAmount: retTaxable,
          cgst: round2(r.cgst || (r.gstAmount || 0) / 2),
          sgst: round2(r.sgst || (r.gstAmount || 0) / 2),
          igst: round2(r.igst || 0),
          cess: 0,
          reason: 'Sales Return',
        });
      } else {
        cdnuRows.push({
          type: retVal > b2clThreshold(r.date) ? 'B2CL' : 'B2CS',
          noteNo: r.invoiceNo || r.returnNo,
          noteDate: retDate,
          noteType: 'C',
          pos: posFullName,
          taxRate: taxRate.toFixed(2),
          taxableAmount: retTaxable,
          netAmount: retVal,
          cgst: round2(r.cgst || (r.gstAmount || 0) / 2),
          sgst: round2(r.sgst || (r.gstAmount || 0) / 2),
          igst: round2(r.igst || 0),
          reason: 'Sales Return',
        });
      }
    }

    // CDNR carries notes issued to REGISTERED recipients (grouped by their CTIN).
    const cdnr = Object.values(cdnrByCtin).filter((g) => g.ctin && g.nt.length);
    const cdnur = cdnuRows.map((n) => ({
      typ: n.type,
      ntty: n.noteType,
      nt_num: n.noteNo,
      nt_dt: n.noteDate,
      val: n.netAmount,
      txval: n.taxableAmount,
      iamt: n.igst || 0,
      camt: n.cgst || 0,
      samt: n.sgst || 0,
      rsn: n.reason,
    }));

    const creditNotes = notes.filter((n) => n.noteType === 'Credit');
    const debitNotes = notes.filter((n) => n.noteType === 'Debit');
    const salesReturns = returns.filter((r) => r.returnType === 'Sales');
    const invoiceSeries = buildDocSeries(sales, cancelledSales, 'Invoices for outward supply');
    const creditSeries = buildDocSeries(
      [
        ...creditNotes.map((n) => ({ invoiceNo: n.noteNo })),
        ...salesReturns.map((r) => ({ invoiceNo: r.invoiceNo || r.returnNo })),
      ],
      [],
      'Credit Note'
    );
    const debitSeries = buildDocSeries(debitNotes.map((n) => ({ invoiceNo: n.noteNo })), [], 'Debit Note');
    const emptyDocRow = (docType) => ({
      docType, from: '', to: '', totnum: 0, cancel: 0, net_issue: 0,
    });
    const docsRows = [
      ...invoiceSeries,
      ...(debitSeries.length ? debitSeries : [emptyDocRow('Debit Note')]),
      ...(creditSeries.length ? creditSeries : [emptyDocRow('Credit Note')]),
    ];

    const exempRows = Object.values(exempMap).map(e => ({
      description: e.desc,
      nilRated: e.nil,
      exempted: e.exempt,
      nonGst: e.nonGst,
    }));

    const payload = {
      gstin: cfg.gstin,
      fp: filingPeriodFp(period),
      version: 'GST3.2.2',
      hash: '',
      b2b,
      b2bRows,
      b2cl,
      b2clRows,
      b2cs: Object.values(b2csMap),
      cdnr,
      cdnrRows,
      cdnur,
      cdnuRows,
      hsn: {
        data: Object.values(hsnMap),
        hsn_b2b: Object.values(hsnB2bMap),
        hsn_b2c: Object.values(hsnB2cMap),
      },
      hsnRows: Object.values(hsnB2bMap),
      hsnB2cRows: Object.values(hsnB2cMap),
      doc_issue: {
        doc_det: [
          { doc_num: 1, docs: invoiceSeries },
          { doc_num: 4, docs: debitSeries },
          { doc_num: 5, docs: creditSeries },
        ]
          .filter((d) => d.docs.length)
          .map((d) => ({
            doc_num: d.doc_num,
            docs: d.docs.map((x, i) => ({
              num: i + 1, from: x.from, to: x.to, totnum: x.totnum, cancel: x.cancel, net_issue: x.net_issue,
            })),
          })),
      },
      docsRows,
      expRows,
      exempRows,
    };

    let netTaxable = sales.reduce((s, x) => s + (x.taxableAmount || 0), 0);
    let netCgst = sales.reduce((s, x) => s + (x.cgst || 0), 0);
    let netSgst = sales.reduce((s, x) => s + (x.sgst || 0), 0);
    let netIgst = sales.reduce((s, x) => s + (x.igst || 0), 0);
    let netCess = sales.reduce((s, x) => s + (x.cess || 0), 0);

    for (const n of notes) {
      const t = n.taxableAmount || n.amount || 0;
      const c = n.cgst || 0;
      const s = n.sgst || 0;
      const i = n.igst || 0;
      const cs = n.cess || 0;
      if (n.noteType === 'Credit') {
        netTaxable -= t; netCgst -= c; netSgst -= s; netIgst -= i; netCess -= cs;
      } else if (n.noteType === 'Debit') {
        netTaxable += t; netCgst += c; netSgst += s; netIgst += i; netCess += cs;
      }
    }

    for (const r of returns) {
      if (r.returnType === 'Sales') {
        netTaxable -= r.taxableAmount || 0;
        netCgst -= r.cgst || 0;
        netSgst -= r.sgst || 0;
        netIgst -= r.igst || 0;
        netCess -= r.cess || 0;
      }
    }

    const totals = {
      taxable: round2(sales.reduce((s, x) => s + (x.taxableAmount || 0), 0)),
      netTaxable: round2(netTaxable),
      cgst: round2(sales.reduce((s, x) => s + (x.cgst || 0), 0)),
      netCgst: round2(netCgst),
      sgst: round2(sales.reduce((s, x) => s + (x.sgst || 0), 0)),
      netSgst: round2(netSgst),
      igst: round2(sales.reduce((s, x) => s + (x.igst || 0), 0)),
      netIgst: round2(netIgst),
      cess: round2(sales.reduce((s, x) => s + (x.cess || 0), 0)),
      totalTax: round2(sales.reduce((s, x) => s + (x.cgst || 0) + (x.sgst || 0) + (x.igst || 0) + (x.cess || 0), 0)),
      invoiceCount: sales.length,
      // Taxable outward supply only (excludes Export / ZeroRated / Exempt / Nil / NonGST)
      taxableSupply: round2(sales.reduce((s, x) => {
        const type = String(x.gstType || '');
        if (type === 'Export' || type === 'ZeroRated' || type === 'Exempt' || type === 'NilRated' || type === 'NonGST') return s;
        const tax = Number(x.cgst || 0) + Number(x.sgst || 0) + Number(x.igst || 0);
        if (Number(x.taxableAmount || 0) > 0 && tax === 0 && !type) return s;
        return s + Number(x.taxableAmount || 0);
      }, 0)),
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
    // Table 4 ITC: purchase bills plus mill, job work and expense bills with GST (JSM: all books inward)
    const purchaseBills = (await this._purchasesInPeriod(companyId, startDate, endDate)).map((p) => ({ ...p, source: 'Purchase' }));
    const purchases = purchaseBills.concat(await this._otherInwardInPeriod(companyId, startDate, endDate));
    const notes = await this._notesInPeriod(companyId, startDate, endDate, 'Sales');
    const returns = await this._returnsInPeriod(companyId, startDate, endDate);

    // Table 3.1 split: taxable / zero-rated / nil-exempt must not be lumped together
    let outwardTaxable = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardIgst = 0;
    let outwardCess = 0;
    let zeroTaxable = 0;
    let zeroIgst = 0;
    let zeroCess = 0;
    let nilExemptTaxable = 0;

    const isNilExempt = (x) => {
      const type = String(x.gstType || '');
      if (type === 'Exempt' || type === 'NilRated' || type === 'NonGST') return true;
      const taxable = Number(x.taxableAmount || 0);
      const tax = Number(x.cgst || 0) + Number(x.sgst || 0) + Number(x.igst || 0) + Number(x.gstAmount || 0);
      return taxable > 0 && tax === 0 && type !== 'Export' && type !== 'ZeroRated';
    };

    for (const x of sales) {
      const type = String(x.gstType || '');
      const tx = Number(x.taxableAmount || 0);
      if (type === 'Export' || type === 'ZeroRated') {
        zeroTaxable += tx;
        zeroIgst += Number(x.igst || 0);
        zeroCess += Number(x.cess || 0);
      } else if (isNilExempt(x)) {
        nilExemptTaxable += tx;
      } else {
        outwardTaxable += tx;
        outwardCgst += Number(x.cgst || 0);
        outwardSgst += Number(x.sgst || 0);
        outwardIgst += Number(x.igst || 0);
        outwardCess += Number(x.cess || 0);
      }
    }

    // CN/DN and sales returns adjust taxable outward (3.1(a)); rare export/nil notes stay out of scope
    for (const n of notes) {
      const t = n.taxableAmount || n.amount || 0;
      const c = n.cgst || 0;
      const s = n.sgst || 0;
      const i = n.igst || 0;
      const cs = n.cess || 0;
      if (n.noteType === 'Credit') {
        outwardTaxable -= t; outwardCgst -= c; outwardSgst -= s; outwardIgst -= i; outwardCess -= cs;
      } else if (n.noteType === 'Debit') {
        outwardTaxable += t; outwardCgst += c; outwardSgst += s; outwardIgst += i; outwardCess += cs;
      }
    }

    for (const r of returns) {
      if (r.returnType === 'Sales') {
        outwardTaxable -= r.taxableAmount || 0;
        outwardCgst -= r.cgst || 0;
        outwardSgst -= r.sgst || 0;
        outwardIgst -= r.igst || 0;
        outwardCess -= r.cess || 0;
      }
    }

    const outward = {
      taxable: round2(outwardTaxable),
      cgst: round2(outwardCgst),
      sgst: round2(outwardSgst),
      igst: round2(outwardIgst),
      cess: round2(outwardCess),
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

    // Filter to only ITC-eligible purchases (exclude itcEligibility: 'None')
    const itcEligiblePurchases = purchases.filter((p) => {
      const eligibility = String(p.itcEligibility || 'Inputs').toUpperCase();
      return eligibility !== 'NONE';
    });

    const itcByTy = { IMPG: { iamt: 0, camt: 0, samt: 0, csamt: 0 }, IMPS: { iamt: 0, camt: 0, samt: 0, csamt: 0 }, OTH: { iamt: 0, camt: 0, samt: 0, csamt: 0 } };
    for (const p of itcEligiblePurchases) {
      // RCM ITC is claimed under ISRC in portal terms; keep in OTH bucket for domestic unless import
      const ty = this._isImportPurchase(p);
      itcByTy[ty].iamt = round2(itcByTy[ty].iamt + (p.igst || 0));
      itcByTy[ty].camt = round2(itcByTy[ty].camt + (p.cgst || 0));
      itcByTy[ty].samt = round2(itcByTy[ty].samt + (p.sgst || 0));
      itcByTy[ty].csamt = round2(itcByTy[ty].csamt + (p.cess || 0));
    }

    const itcAvailable = {
      cgst: round2(itcEligiblePurchases.reduce((s, x) => s + (x.cgst || 0), 0)),
      sgst: round2(itcEligiblePurchases.reduce((s, x) => s + (x.sgst || 0), 0)),
      igst: round2(itcEligiblePurchases.reduce((s, x) => s + (x.igst || 0), 0)),
      cess: round2(itcEligiblePurchases.reduce((s, x) => s + (x.cess || 0), 0)),
    };

    const netPayable = {
      cgst: round2(outward.cgst + rcmTax.cgst - itcAvailable.cgst),
      sgst: round2(outward.sgst + rcmTax.sgst - itcAvailable.sgst),
      igst: round2(outward.igst + rcmTax.igst - itcAvailable.igst),
      cess: round2(outward.cess - itcAvailable.cess),
    };

    const itcAvl = Object.entries(itcByTy)
      .filter(([, v]) => v.iamt || v.camt || v.samt || v.csamt)
      .map(([ty, v]) => ({ ty, iamt: v.iamt, camt: v.camt, samt: v.samt, csamt: v.csamt }));
    if (!itcAvl.length) {
      itcAvl.push({ ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 });
    }

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
        osup_zero: {
          txval: round2(zeroTaxable),
          iamt: round2(zeroIgst),
          csamt: round2(zeroCess),
        },
        osup_nil_exmp: { txval: round2(nilExemptTaxable) },
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
        itc_avl: itcAvl,
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
      // ITC per source, as JSM shows Table 4 (Purchase, Mill, JobWork, Expense)
      itcBySource: ['Purchase', 'Mill', 'JobWork', 'Expense'].map((source) => {
        const list = itcEligiblePurchases.filter((x) => x.source === source);
        const sum = (f) => round2(list.reduce((acc, x) => acc + (x[f] || 0), 0));
        return { source, count: list.length, taxable: sum('taxableAmount'), igst: sum('igst'), cgst: sum('cgst'), sgst: sum('sgst'), cess: sum('cess') };
      }),
    };

    return {
      payload,
      totals: {
        taxable: outward.taxable,
        cgst: netPayable.cgst,
        sgst: netPayable.sgst,
        igst: netPayable.igst,
        invoiceCount: sales.length,
        zeroRated: round2(zeroTaxable),
        nilExempt: round2(nilExemptTaxable),
      },
      period,
    };
  }

  _sumGstr1B2bTax(g1) {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    for (const b of g1.b2b || []) {
      for (const inv of b.inv || []) {
        for (const it of inv.itms || []) {
          const d = it.itm_det || {};
          taxable += Number(d.txval || 0);
          cgst += Number(d.camt || 0);
          sgst += Number(d.samt || 0);
          igst += Number(d.iamt || 0);
        }
      }
    }
    return {
      taxable: round2(taxable),
      cgst: round2(cgst),
      sgst: round2(sgst),
      igst: round2(igst),
    };
  }

  _sumGstr1B2cTax(g1) {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    // B2CS rows carry txval/tax; B2CL invoices carry them in itms[].itm_det (inv.val is the invoice value).
    const rows = [
      ...(g1.b2cs || []),
      ...(g1.b2cl || []).flatMap((inv) => (inv.itms || []).map((it) => it.itm_det || {})),
    ];
    for (const row of rows) {
      taxable += Number(row.txval || 0);
      cgst += Number(row.camt || 0);
      sgst += Number(row.samt || 0);
      igst += Number(row.iamt || 0);
    }
    return {
      taxable: round2(taxable),
      cgst: round2(cgst),
      sgst: round2(sgst),
      igst: round2(igst),
    };
  }

  _sumGstr1ExportTax(g1) {
    let taxable = 0;
    let igst = 0;
    for (const row of g1.expRows || []) {
      taxable += Number(row.taxableAmount || 0);
      igst += Number(row.igst || 0);
    }
    return { taxable: round2(taxable), cgst: 0, sgst: 0, igst: round2(igst) };
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
    const table4a = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const table4b = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const table4c = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    for (const period of months) {
      const g1 = await this.buildGstr1(companyId, period);
      monthly.push({ period, totals: g1.totals });
      taxable += g1.totals.taxable;
      cgst += g1.totals.cgst;
      sgst += g1.totals.sgst;
      igst += g1.totals.igst;

      const b2b = this._sumGstr1B2bTax(g1);
      const b2c = this._sumGstr1B2cTax(g1);
      const exp = this._sumGstr1ExportTax(g1);
      table4a.taxable += b2b.taxable;
      table4a.cgst += b2b.cgst;
      table4a.sgst += b2b.sgst;
      table4a.igst += b2b.igst;
      table4b.taxable += b2c.taxable;
      table4b.cgst += b2c.cgst;
      table4b.sgst += b2c.sgst;
      table4b.igst += b2c.igst;
      table4c.taxable += exp.taxable;
      table4c.igst += exp.igst;
    }

    const cfg = await this._companyCtx(companyId);
    const table4 = { taxable: round2(taxable), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst) };
    const roundBlock = (b) => ({
      taxable: round2(b.taxable),
      cgst: round2(b.cgst),
      sgst: round2(b.sgst),
      igst: round2(b.igst),
    });
    return {
      payload: {
        gstin: cfg.gstin,
        financialYear,
        table4,
        table4a: roundBlock(table4a),
        table4b: roundBlock(table4b),
        table4c: roundBlock(table4c),
        monthly,
        gstr9cReady: true,
      },
      totals: table4,
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
