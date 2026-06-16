const salesService = require('../services/salesService');
const auditService = require('../services/auditService');

exports.createInvoice = async (req, res) => {
  try {
    req.body.companyId = req.companyId;
    const sales = await salesService.createInvoice(req.body);
    await auditService.log(req, 'CREATE_INVOICE', 'Sales', sales._id, null, { invoiceNo: sales.invoiceNo, amount: sales.netAmount });
    res.status(201).json({ success: true, data: sales });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    // Updated to support pagination if salesService supports it, though for now passing full req.query
    const sales = await salesService.getSales(companyId, req.query || {});
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSale = async (req, res) => {
  try {
    const sale = await salesService.getSaleById(req.params.id, req.companyId);
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.updateSaleStatus = async (req, res) => {
  try {
    const sale = await salesService.updateSaleStatus(req.params.id, req.companyId, req.body.status);
    await auditService.log(req, 'UPDATE_STATUS', 'Sales', sale._id, { status: 'UNKNOWN' }, { status: sale.status });
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const result = await salesService.deleteSale(req.params.id, req.companyId);
    await auditService.log(req, 'DELETE_INVOICE', 'Sales', req.params.id, result, null);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

