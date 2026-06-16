const purchaseService = require('../services/purchaseService');
const auditService = require('../services/auditService');

exports.createPurchase = async (req, res) => {
  try {
    req.body.companyId = req.companyId;
    const purchase = await purchaseService.createPurchase(req.body);
    await auditService.log(req, 'CREATE_BILL', 'Purchase', purchase._id, null, { invoiceNo: purchase.invoiceNo, amount: purchase.netAmount });
    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    // Updated to support pagination if purchaseService supports it
    const purchases = await purchaseService.getPurchases(companyId, req.query || {});
    res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPurchase = async (req, res) => {
  try {
    const purchase = await purchaseService.getPurchaseById(req.params.id, req.companyId);
    res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.updatePurchaseStatus = async (req, res) => {
  try {
    const purchase = await purchaseService.updatePurchaseStatus(req.params.id, req.companyId, req.body.status);
    await auditService.log(req, 'UPDATE_STATUS', 'Purchase', purchase._id, { status: 'UNKNOWN' }, { status: purchase.status });
    res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deletePurchase = async (req, res) => {
  try {
    const result = await purchaseService.deletePurchase(req.params.id, req.companyId);
    await auditService.log(req, 'DELETE_BILL', 'Purchase', req.params.id, result, null);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

