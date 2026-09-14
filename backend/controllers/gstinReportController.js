const gstinReportService = require('../services/gstinReportService');

/**
 * GSTIN Report Controller — all GSTIN-wise reports.
 * Every endpoint returns data from actual transactions.
 */
const ctrl = {

  // ─── GSTIN Sales ───
  async gstinSalesSummary(req, res) {
    try {
      const data = await gstinReportService.getGstinSalesSummary(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async gstinSalesDetail(req, res) {
    try {
      const data = await gstinReportService.getGstinSalesDetail(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async gstinSalesReturnSummary(req, res) {
    try {
      const data = await gstinReportService.getGstinSalesReturnSummary(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async gstinSalesReturnDetail(req, res) {
    try {
      const data = await gstinReportService.getGstinSalesReturnDetail(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTIN Purchase ───
  async gstinPurchaseSummary(req, res) {
    try {
      const data = await gstinReportService.getGstinPurchaseSummary(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async gstinPurchaseDetail(req, res) {
    try {
      const data = await gstinReportService.getGstinPurchaseDetail(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async gstinPurchaseReturnSummary(req, res) {
    try {
      const data = await gstinReportService.getGstinPurchaseReturnSummary(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async gstinPurchaseReturnDetail(req, res) {
    try {
      const data = await gstinReportService.getGstinPurchaseReturnDetail(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTIN Process ───
  async gstinProcess(req, res) {
    try {
      const data = await gstinReportService.getGstinProcessReport(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTIN JobWork ───
  async gstinJobWork(req, res) {
    try {
      const data = await gstinReportService.getGstinJobWorkReport(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTIN Journal ───
  async gstinJournal(req, res) {
    try {
      const data = await gstinReportService.getGstinJournalReport(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTIN Expense ───
  async gstinExpense(req, res) {
    try {
      const data = await gstinReportService.getGstinExpenseReport(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTR-1 Error Checking ───
  async gstr1Errors(req, res) {
    try {
      const data = await gstinReportService.checkGstr1Errors(req.companyId, req.query.fromDate, req.query.toDate);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTR-3B Error Checking ───
  async gstr3bErrors(req, res) {
    try {
      const data = await gstinReportService.checkGstr3bErrors(req.companyId, req.query.period);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GSTR-3B Drill-Down ───
  async gstr3bDrillDown(req, res) {
    try {
      const data = await gstinReportService.getGstr3bDrillDown(req.companyId, req.query.period, req.query.section);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── ITC-04 ───
  async itc04(req, res) {
    try {
      const data = await gstinReportService.getItc04Report(req.companyId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── Cross-Report Reconciliation ───
  async crossReconciliation(req, res) {
    try {
      const data = await gstinReportService.crossReportReconciliation(req.companyId, req.query.period);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = ctrl;
