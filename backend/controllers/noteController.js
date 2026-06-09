const DebitCreditNote = require('../models/DebitCreditNote');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const accountingService = require('../services/accountingService');

async function generateNoteNo(companyId, type) {
  const prefix = type === 'Debit' ? 'DN' : 'CN';
  const count = await DebitCreditNote.countDocuments({ companyId, noteType: type });
  const padded = (count + 1).toString().padStart(4, '0');
  const currentYear = new Date().getFullYear().toString().substring(2);
  return `${prefix}-${currentYear}-${padded}`;
}

exports.createNote = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { noteType, noteNo, partyLedgerId, date, amount, againstInvoiceNo, reason, status } = req.body;

    if (!noteType || !partyLedgerId || !amount) {
      return res.status(400).json({ success: false, message: 'Type, party ledger, and amount are required' });
    }

    let resolvedPartyLedger = await LedgerMaster.findById(partyLedgerId);
    if (!resolvedPartyLedger) {
      try {
        resolvedPartyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyLedgerId);
      } catch (err) {
        // let subsequent check handle missing ledger
      }
    }

    if (!resolvedPartyLedger) {
      return res.status(400).json({ success: false, message: 'Invalid party ledger selection' });
    }

    const finalNoteNo = noteNo || await generateNoteNo(companyId, noteType);

    const note = await DebitCreditNote.create({
      companyId,
      noteType,
      noteNo: finalNoteNo,
      partyLedgerId: resolvedPartyLedger._id,
      date: date || new Date(),
      amount,
      againstInvoiceNo,
      reason,
      status: status || 'Draft'
    });

    if (status === 'Posted') {
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');
      const lines = [];

      if (noteType === 'Credit') {
        // Credit Note: Debit Sales A/c, Credit Party Ledger
        const salesLedger = await accountingService.getSystemLedger(companyId, 'Sales A/c');
        lines.push({
          ledgerId: salesLedger._id,
          ledgerName: salesLedger.name,
          type: 'Dr',
          amount: parseFloat(amount),
          narration: `Credit Note adjustments. Reason: ${reason || ''}`
        });
        lines.push({
          ledgerId: resolvedPartyLedger._id,
          ledgerName: resolvedPartyLedger.name,
          type: 'Cr',
          amount: parseFloat(amount),
          narration: `Credit Note #${finalNoteNo}`
        });
      } else {
        // Debit Note: Debit Party Ledger, Credit Purchase A/c
        const purchaseLedger = await accountingService.getSystemLedger(companyId, 'Purchase A/c');
        lines.push({
          ledgerId: resolvedPartyLedger._id,
          ledgerName: resolvedPartyLedger.name,
          type: 'Dr',
          amount: parseFloat(amount),
          narration: `Debit Note #${finalNoteNo}`
        });
        lines.push({
          ledgerId: purchaseLedger._id,
          ledgerName: purchaseLedger.name,
          type: 'Cr',
          amount: parseFloat(amount),
          narration: `Debit Note adjustments. Reason: ${reason || ''}`
        });
      }

      await AccountingEntry.create({
        companyId,
        entryNo,
        entryDate: date || new Date(),
        voucherType: noteType === 'Credit' ? 'Journal' : 'Journal',
        refType: noteType === 'Credit' ? 'CreditNote' : 'DebitNote',
        refId: note._id,
        lines,
        narration: reason || `${noteType} Note adjustments`
      });
    }

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A note with this number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNotes = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { noteType } = req.query;

    const filter = { companyId };
    if (noteType) {
      filter.noteType = noteType;
    }

    const list = await DebitCreditNote.find(filter).populate('partyLedgerId').sort({ date: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
