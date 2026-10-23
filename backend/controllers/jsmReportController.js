const jsmReports = require('../services/jsmReports');

function send(res, err) {
  res.status(err.status || 500).json({ success: false, message: err.message });
}

exports.run = async (req, res) => {
  try {
    let params = {};
    if (req.query.q) {
      try { params = JSON.parse(req.query.q); } catch (_) {
        return res.status(400).json({ success: false, message: 'Invalid report parameters' });
      }
    }
    const data = await jsmReports.get(req.params.reportId).run(req.companyId, params);
    res.json({ success: true, data });
  } catch (err) {
    send(res, err);
  }
};

exports.options = async (req, res) => {
  try {
    const report = jsmReports.get(req.params.reportId);
    const data = report.options ? await report.options(req.companyId) : {};
    res.json({ success: true, data });
  } catch (err) {
    send(res, err);
  }
};
