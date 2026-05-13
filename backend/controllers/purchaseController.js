const purchaseService = require('../services/purchaseService');

exports.createPurchase = async (req, res) => {
  try {
    const purchase = await purchaseService.createPurchase(req.body);
    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const { companyId } = req.query;
    const purchases = await purchaseService.getPurchases(companyId);
    res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
