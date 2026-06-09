const reportService = require('../services/reportService');

exports.getStockReport = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const stock = await reportService.getStockReport(companyId);
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOutstanding = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const { type } = req.query;
    const outstanding = await reportService.getOutstanding(companyId, type);
    res.status(200).json({ success: true, data: outstanding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const { startDate, endDate } = req.query;
    const pl = await reportService.getProfitLoss(companyId, startDate, endDate);
    res.status(200).json({ success: true, data: pl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
