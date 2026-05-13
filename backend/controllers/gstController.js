const gstService = require('../services/gstService');

exports.getGstr1 = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    const data = await gstService.getGstr1(companyId, startDate, endDate);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGstr2 = async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;
    const data = await gstService.getGstr2(companyId, startDate, endDate);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
