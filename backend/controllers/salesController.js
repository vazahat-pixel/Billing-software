const salesService = require('../services/salesService');

exports.createInvoice = async (req, res) => {
  try {
    const sales = await salesService.createInvoice(req.body);
    res.status(201).json({ success: true, data: sales });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { companyId } = req.query;
    const sales = await salesService.getSales(companyId);
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
