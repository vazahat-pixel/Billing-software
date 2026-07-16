const crypto = require('crypto');
const EInvoice = require('../models/EInvoice');
const EWayBill = require('../models/EWayBill');
const Sales = require('../models/Sales');
const gstConfigService = require('./gstConfigService');
const auditService = require('./auditService');
const { validateGstin, stateCodeFromGstin } = require('../utils/gstDetermination');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * E-Invoice & E-Way Bill Engine — Sprint 4.6
 * Builds NIC-schema payloads; Mock provider generates IRN/EWB for sandbox.
 * Swap provider to NIC/GSP without changing callers.
 */
class EinvoiceEwayService {
  async buildEinvoicePayload(companyId, salesId) {
    const cfg = await gstConfigService.getOrCreate(companyId);
    const sale = await Sales.findOne({ _id: salesId, companyId })
      .populate('customerId')
      .populate('items.itemId')
      .lean();
    if (!sale) throw new Error('Sales invoice not found');

    const buyerGstin = (sale.customerId?.gstin || '').toUpperCase();
    const payload = {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: sale.gstType === 'Export' ? 'EXPWOP' : 'B2B',
        RegRev: sale.reverseCharge ? 'Y' : 'N',
        EcmGstin: null,
      },
      DocDtls: {
        Typ: 'INV',
        No: sale.invoiceNo,
        Dt: sale.date ? new Date(sale.date).toLocaleDateString('en-GB').replace(/\//g, '/') : '',
      },
      SellerDtls: {
        Gstin: cfg.gstin,
        LglNm: cfg.legalName || cfg.tradeName,
        Addr1: '',
        Loc: cfg.stateName || '',
        Pin: 0,
        Stcd: cfg.stateCode || stateCodeFromGstin(cfg.gstin),
      },
      BuyerDtls: {
        Gstin: buyerGstin || 'URP',
        LglNm: sale.customerId?.name || 'Cash',
        Pos: stateCodeFromGstin(buyerGstin) || cfg.stateCode,
        Addr1: sale.customerId?.address || '',
        Loc: sale.customerId?.state || '',
        Pin: Number(sale.customerId?.pincode || 0) || 0,
        Stcd: stateCodeFromGstin(buyerGstin) || sale.customerId?.stateCode || cfg.stateCode,
      },
      ItemList: (sale.items || []).map((line, idx) => ({
        SlNo: String(idx + 1),
        PrdDesc: line.itemId?.name || line.name || 'Item',
        IsServc: 'N',
        HsnCd: line.itemId?.hsnCode || line.hsnCode || '',
        Qty: Number(line.mts || line.qty || 0),
        Unit: 'MTR',
        UnitPrice: Number(line.rate || 0),
        TotAmt: round2(line.amount || 0),
        AssAmt: round2(line.amount || 0),
        GstRt: Number(line.itemId?.gstRate || sale.gstRate || 0),
        IgstAmt: 0,
        CgstAmt: 0,
        SgstAmt: 0,
        TotItemVal: round2(line.amount || 0),
      })),
      ValDtls: {
        AssVal: round2(sale.taxableAmount),
        CgstVal: round2(sale.cgst),
        SgstVal: round2(sale.sgst),
        IgstVal: round2(sale.igst),
        CesVal: round2(sale.cess || 0),
        TotInvVal: round2(sale.netAmount),
      },
    };

    // Distribute tax on first item for schema completeness
    if (payload.ItemList.length) {
      payload.ItemList[0].CgstAmt = round2(sale.cgst);
      payload.ItemList[0].SgstAmt = round2(sale.sgst);
      payload.ItemList[0].IgstAmt = round2(sale.igst);
      payload.ItemList[0].TotItemVal = round2(
        payload.ItemList[0].AssAmt + sale.cgst + sale.sgst + sale.igst
      );
    }

    return { sale, cfg, payload };
  }

  async generateEinvoice(companyId, salesId, userId, { provider = 'Mock' } = {}) {
    const cfg = await gstConfigService.getOrCreate(companyId);
    if (!cfg.eInvoiceEnabled && provider !== 'Mock') {
      throw new Error('E-Invoice not enabled in GST config');
    }

    const { sale, payload } = await this.buildEinvoicePayload(companyId, salesId);
    if (sale.customerId?.gstin) {
      const v = validateGstin(sale.customerId.gstin);
      if (!v.ok) throw new Error(`Buyer GSTIN invalid: ${v.reason}`);
    }

    let irn = '';
    let ackNo = '';
    let ackDate = null;
    let qrCodeData = '';
    let responsePayload = {};
    let status = 'Generated';

    if (provider === 'Mock') {
      irn = crypto.createHash('sha256')
        .update(`${companyId}|${sale.invoiceNo}|${sale.netAmount}|${Date.now()}`)
        .digest('hex');
      ackNo = String(Date.now());
      ackDate = new Date();
      qrCodeData = JSON.stringify({ irn, ackNo, invoiceNo: sale.invoiceNo });
      responsePayload = { Status: 'ACT', Irn: irn, AckNo: ackNo, AckDt: ackDate.toISOString() };
    } else {
      // Future: NIC/GSP HTTP client
      status = 'Ready';
      responsePayload = { Status: 'PENDING_NIC', message: 'Provider adapter not configured' };
    }

    const doc = await EInvoice.findOneAndUpdate(
      { companyId, salesId },
      {
        companyId,
        salesId,
        invoiceNo: sale.invoiceNo,
        invoiceDate: sale.date,
        status,
        irn,
        ackNo,
        ackDate,
        qrCodeData,
        requestPayload: payload,
        responsePayload,
        provider,
        errorMessage: '',
        updatedBy: userId,
      },
      { upsert: true, new: true }
    );

    await auditService.logSystem({
      companyId, userId, action: 'EINVOICE_GENERATE', module: 'EInvoice',
      referenceId: doc._id, after: { irn, status, provider },
    });
    return doc;
  }

  async cancelEinvoice(companyId, id, reason, userId) {
    const doc = await EInvoice.findOne({ _id: id, companyId });
    if (!doc) throw new Error('E-Invoice not found');
    if (doc.status !== 'Generated') throw new Error('Only generated IRN can be cancelled');
    doc.status = 'Cancelled';
    doc.cancelReason = reason || 'Cancelled';
    doc.cancelDate = new Date();
    doc.updatedBy = userId;
    await doc.save();
    return doc;
  }

  async buildEwayPayload(companyId, payload) {
    const cfg = await gstConfigService.getOrCreate(companyId);
    let sale = null;
    if (payload.salesId) {
      sale = await Sales.findOne({ _id: payload.salesId, companyId })
        .populate('customerId')
        .lean();
    }

    const requestPayload = {
      supplyType: payload.supplyType || 'O',
      subSupplyType: payload.subSupplyType || '1',
      docType: payload.documentType || 'INV',
      docNo: payload.docNo || sale?.invoiceNo,
      docDate: payload.docDate || sale?.date,
      fromGstin: cfg.gstin,
      fromStateCode: Number(cfg.stateCode || 0),
      toGstin: payload.toGstin || sale?.customerId?.gstin || 'URP',
      toStateCode: Number(
        payload.toStateCode || stateCodeFromGstin(sale?.customerId?.gstin) || cfg.stateCode || 0
      ),
      totalValue: round2(payload.totalValue ?? sale?.netAmount ?? 0),
      cgstValue: round2(payload.cgstValue ?? sale?.cgst ?? 0),
      sgstValue: round2(payload.sgstValue ?? sale?.sgst ?? 0),
      igstValue: round2(payload.igstValue ?? sale?.igst ?? 0),
      transMode: payload.transportMode || '1',
      transDistance: Number(payload.distance || 0),
      transporterName: payload.transporterName || '',
      transporterId: payload.transporterId || '',
      transDocNo: payload.lrNo || '',
      transDocDate: payload.lrDate || null,
      vehicleNo: payload.vehicleNo || '',
      vehicleType: payload.vehicleType || 'R',
    };

    return { cfg, sale, requestPayload };
  }

  async generateEway(companyId, body, userId, { provider = 'Mock' } = {}) {
    const cfg = await gstConfigService.getOrCreate(companyId);
    if (!cfg.eWayEnabled && provider !== 'Mock') {
      throw new Error('E-Way Bill not enabled in GST config');
    }

    const { sale, requestPayload } = await this.buildEwayPayload(companyId, body);
    const value = requestPayload.totalValue;
    if (value < (cfg.eWayThreshold || 50000) && provider !== 'Mock') {
      throw new Error(`Value below e-way threshold ₹${cfg.eWayThreshold}`);
    }

    let ewbNo = '';
    let ewbDate = null;
    let validUpto = null;
    let status = 'Generated';
    let responsePayload = {};

    if (provider === 'Mock') {
      ewbNo = `EWB${Date.now().toString().slice(-12)}`;
      ewbDate = new Date();
      validUpto = new Date(Date.now() + Math.max(1, requestPayload.transDistance || 100) * 60 * 60 * 1000);
      responsePayload = { ewayBillNo: ewbNo, ewayBillDate: ewbDate, validUpto };
    } else {
      status = 'Ready';
      responsePayload = { Status: 'PENDING_NIC' };
    }

    const doc = await EWayBill.create({
      companyId,
      refType: body.refType || 'SalesInvoice',
      refId: body.salesId || body.refId || sale?._id,
      docNo: requestPayload.docNo,
      docDate: requestPayload.docDate,
      status,
      ewbNo,
      ewbDate,
      validUpto,
      fromGstin: requestPayload.fromGstin,
      toGstin: requestPayload.toGstin,
      fromStateCode: String(requestPayload.fromStateCode),
      toStateCode: String(requestPayload.toStateCode),
      supplyType: requestPayload.supplyType,
      totalValue: requestPayload.totalValue,
      cgstValue: requestPayload.cgstValue,
      sgstValue: requestPayload.sgstValue,
      igstValue: requestPayload.igstValue,
      transporterId: requestPayload.transporterId,
      transporterName: requestPayload.transporterName,
      transportMode: requestPayload.transMode,
      vehicleNo: requestPayload.vehicleNo,
      vehicleType: requestPayload.vehicleType,
      lrNo: requestPayload.transDocNo,
      lrDate: requestPayload.transDocDate,
      distance: requestPayload.transDistance,
      requestPayload,
      responsePayload,
      provider,
      createdBy: userId,
    });

    await auditService.logSystem({
      companyId, userId, action: 'EWAY_GENERATE', module: 'EWayBill',
      referenceId: doc._id, after: { ewbNo, status },
    });
    return doc;
  }

  async listEinvoices(companyId, query = {}) {
    const filter = { companyId };
    if (query.status) filter.status = query.status;
    return EInvoice.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  }

  async listEway(companyId, query = {}) {
    const filter = { companyId };
    if (query.status) filter.status = query.status;
    return EWayBill.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  }
}

module.exports = new EinvoiceEwayService();
