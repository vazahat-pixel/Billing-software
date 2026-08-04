const mongoose = require('mongoose');
const DebitCreditNote = require('../models/DebitCreditNote');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const Counter = require('../models/Counter');
const accountingService = require('../services/accountingService');
const auditService = require('../services/auditService');

async function generateNoteNo(companyId, type, session = null) {
  const prefix = type === 'Debit' ? 'DN' : 'CN';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
  const fy = `${currentYear}-${nextYear}`;
  const counterId = `${prefix}-${fy}-${companyId}`;
  const seq = await Counter.nextSeq(counterId, session);
  return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
}

exports.createNote = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.companyId;
    const {
      noteType, noteNo, partyLedgerId, date, amount, againstInvoiceNo, reason, status,
      gstType, gstRate, taxableAmount: clientTaxable,
    } = req.body;

    if (!noteType || !partyLedgerId || !amount) {
      return res.status(400).json({ success: false, message: 'Type, party ledger, and amount are required' });
    }

    // Check GST period is not locked/filed (only if posting immediately)
    if (status === 'Posted') {
      const gstConfigService = require('../services/gstConfigService');
      await gstConfigService.assertPeriodOpen(companyId, date || new Date());
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

    const finalNoteNo = noteNo || await generateNoteNo(companyId, noteType, session);

    // Stage 4: backend GST on notes
    const { computeTaxComponents, determineGstType } = require('../utils/gstDetermination');
    let companyGstin = '';
    let companyStateCode = '';
    try {
      const gstConfigService = require('../services/gstConfigService');
      const cfg = await gstConfigService.getOrCreate(companyId);
      companyGstin = cfg.gstin;
      companyStateCode = cfg.stateCode;
    } catch (_) { /* optional */ }

    const rate = Number(gstRate || 0);
    const taxable = Number(clientTaxable != null ? clientTaxable : (rate > 0 ? amount / (1 + rate / 100) : amount));
    const resolvedType = determineGstType({
      companyGstin,
      companyStateCode,
      forceType: gstType || 'CGST+SGST',
    });
    const tax = computeTaxComponents(
      Number(taxable.toFixed(2)),
      rate,
      resolvedType
    );
    const netAmount = Number((tax.taxableAmount + tax.gstAmount).toFixed(2));

    const noteData = {
      companyId,
      noteType,
      noteNo: finalNoteNo,
      partyLedgerId: resolvedPartyLedger._id,
      date: date || new Date(),
      amount: parseFloat(amount),
      taxableAmount: tax.taxableAmount,
      gstType: tax.gstType,
      gstRate: rate,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      cess: tax.cess,
      gstAmount: tax.gstAmount,
      netAmount: netAmount || parseFloat(amount),
      againstInvoiceNo,
      reason,
      status: status || 'Draft'
    };

    const noteResult = await DebitCreditNote.create([noteData], { session });
    const note = noteResult[0];

    if (status === 'Posted') {
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
      const lines = [];
      const baseAmt = tax.taxableAmount || parseFloat(amount);
      const partyAmt = netAmount || parseFloat(amount);

      if (noteType === 'Credit') {
        const salesLedger = await accountingService.getSystemLedger(companyId, 'Sales Return A/c', session);
        lines.push({
          ledgerId: salesLedger._id,
          ledgerName: salesLedger.name,
          type: 'Dr',
          amount: baseAmt,
          narration: `Credit Note. Reason: ${reason || ''}`
        });
        if (tax.cgst > 0) {
          const led = await accountingService.getSystemLedger(companyId, 'CGST Output', session);
          lines.push({ ledgerId: led._id, ledgerName: led.name, type: 'Dr', amount: tax.cgst, narration: 'CGST reversal' });
        }
        if (tax.sgst > 0) {
          const led = await accountingService.getSystemLedger(companyId, 'SGST Output', session);
          lines.push({ ledgerId: led._id, ledgerName: led.name, type: 'Dr', amount: tax.sgst, narration: 'SGST reversal' });
        }
        if (tax.igst > 0) {
          const led = await accountingService.getSystemLedger(companyId, 'IGST Output', session);
          lines.push({ ledgerId: led._id, ledgerName: led.name, type: 'Dr', amount: tax.igst, narration: 'IGST reversal' });
        }
        lines.push({
          ledgerId: resolvedPartyLedger._id,
          ledgerName: resolvedPartyLedger.name,
          type: 'Cr',
          amount: partyAmt,
          narration: `Credit Note #${finalNoteNo}`
        });
      } else {
        const purchaseLedger = await accountingService.getSystemLedger(companyId, 'Purchase Return A/c', session);
        lines.push({
          ledgerId: resolvedPartyLedger._id,
          ledgerName: resolvedPartyLedger.name,
          type: 'Dr',
          amount: partyAmt,
          narration: `Debit Note #${finalNoteNo}`
        });
        lines.push({
          ledgerId: purchaseLedger._id,
          ledgerName: purchaseLedger.name,
          type: 'Cr',
          amount: baseAmt,
          narration: `Debit Note. Reason: ${reason || ''}`
        });
        if (tax.cgst > 0) {
          const led = await accountingService.getSystemLedger(companyId, 'CGST Input', session);
          lines.push({ ledgerId: led._id, ledgerName: led.name, type: 'Cr', amount: tax.cgst, narration: 'CGST Input reversal' });
        }
        if (tax.sgst > 0) {
          const led = await accountingService.getSystemLedger(companyId, 'SGST Input', session);
          lines.push({ ledgerId: led._id, ledgerName: led.name, type: 'Cr', amount: tax.sgst, narration: 'SGST Input reversal' });
        }
        if (tax.igst > 0) {
          const led = await accountingService.getSystemLedger(companyId, 'IGST Input', session);
          lines.push({ ledgerId: led._id, ledgerName: led.name, type: 'Cr', amount: tax.igst, narration: 'IGST Input reversal' });
        }
      }

      await AccountingEntry.create([{
        companyId,
        entryNo,
        entryDate: date || new Date(),
        voucherType: 'NoteAuto',
        refType: noteType === 'Credit' ? 'CreditNote' : 'DebitNote',
        refId: note._id,
        lines,
        narration: reason || `${noteType} Note adjustments`
      }], { session });
    }

    await session.commitTransaction();

    // Audit log
    await auditService.log(req, `CREATE_${noteType.toUpperCase()}_NOTE`, 'DebitCreditNote', note._id, null, {
      noteNo: note.noteNo,
      noteType,
      amount: note.netAmount,
      status
    });

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A note with this number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
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
