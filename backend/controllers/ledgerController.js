const ledgerService = require('../services/ledgerService');

exports.getPartyLedger = async (req, res) => {
  try {
    const { partyId } = req.params;
    const { companyId, startDate, endDate } = req.query;
    const ledger = await ledgerService.getPartyLedger(partyId, companyId, startDate, endDate);
    const balance = await ledgerService.getAccountBalance(partyId, companyId);
    
    res.status(200).json({ 
      success: true, 
      data: {
        entries: ledger,
        closingBalance: balance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAccountBalance = async (req, res) => {
  try {
    const { partyId } = req.params;
    const { companyId } = req.query;
    const balance = await ledgerService.getAccountBalance(partyId, partyId);
    res.status(200).json({ success: true, balance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
