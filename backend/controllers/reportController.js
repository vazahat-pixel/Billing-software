const reportService = require('../services/reportService');

const companyId = (req) => req.companyId || req.query.companyId;

exports.getStockReport = async (req, res) => {
  try {
    const stock = await reportService.getStockReport(companyId(req));
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const csvToArray = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

exports.getOutstanding = async (req, res) => {
  try {
    const {
      type, asOn, billDateFrom, billDateTo, paidDateFrom, paidDateTo, status,
      partyIds, brokerIds, stations, hastes, bookIds, states, msmeTypes, mainGroups,
      remarkSearch, dueDaysMin, onlyFullBill, onlyPartReceived, includeLastYear, fyStartDate,
    } = req.query;
    const outstanding = await reportService.getOutstanding(companyId(req), type || 'receivable', {
      asOn,
      billDateFrom,
      billDateTo,
      paidDateFrom,
      paidDateTo,
      status: status || 'Pending',
      partyIds: csvToArray(partyIds),
      brokerIds: csvToArray(brokerIds),
      stations: csvToArray(stations),
      hastes: csvToArray(hastes),
      bookIds: csvToArray(bookIds),
      states: csvToArray(states),
      msmeTypes: csvToArray(msmeTypes),
      mainGroups: csvToArray(mainGroups),
      remarkSearch: remarkSearch || '',
      dueDaysMin: dueDaysMin != null && dueDaysMin !== '' ? Number(dueDaysMin) : undefined,
      onlyFullBill: onlyFullBill === 'true',
      onlyPartReceived: onlyPartReceived === 'true',
      includeLastYear: includeLastYear !== 'false',
      fyStartDate,
      onlyRgPending: req.query.onlyRgPending === 'true',
      onlyDirectBillClose: req.query.onlyDirectBillClose === 'true',
      withLedgerBalance: req.query.withLedgerBalance === 'true',
    });
    res.status(200).json({ success: true, data: outstanding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOutstandingFilterOptions = async (req, res) => {
  try {
    const { type } = req.query;
    const options = await reportService.getOutstandingFilterOptions(companyId(req), type || 'receivable');
    res.status(200).json({ success: true, data: options });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pl = await reportService.getProfitLoss(companyId(req), startDate, endDate);
    res.status(200).json({ success: true, data: pl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSalesRegister = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportService.getSalesRegister(companyId(req), startDate, endDate);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPurchaseRegister = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportService.getPurchaseRegister(companyId(req), startDate, endDate);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobWorkReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportService.getJobWorkReport(companyId(req), startDate, endDate);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDailyTransactions = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportService.getDailyTransactions(companyId(req), startDate, endDate);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMasterSummary = async (req, res) => {
  try {
    const data = await reportService.getMasterSummary(companyId(req));
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReportBundle = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const bundle = await reportService.getReportBundle(companyId(req), startDate, endDate);
    res.set('Cache-Control', 'private, max-age=15');
    res.status(200).json({ success: true, data: bundle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
