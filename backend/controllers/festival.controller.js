const festivalService = require('../services/festivalService');

exports.list = async (req, res, next) => {
  try {
    const years = await festivalService.listYears();
    res.json({ success: true, data: years });
  } catch (err) {
    next(err);
  }
};

exports.getYear = async (req, res, next) => {
  try {
    const doc = await festivalService.getYear(req.params.year);
    if (!doc) {
      return res.status(404).json({ success: false, message: `No festival calendar for ${req.params.year}` });
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

exports.active = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const festival = await festivalService.getActiveFestival(date);
    res.json({
      success: true,
      data: {
        date: festivalService.toDateOnly(date),
        festival,
        active: !!festival,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.upsertYear = async (req, res, next) => {
  try {
    const festivals = Array.isArray(req.body?.festivals) ? req.body.festivals : [];
    const notes = req.body?.notes || '';
    const doc = await festivalService.upsertYear(req.params.year, festivals, notes);
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};
