const ReturnInvoice = require('../models/ReturnInvoice');
const AccountingEntry = require('../models/AccountingEntry');
const accountingService = require('../services/accountingService');

async function generateReturnNo(companyId, type) {
  const prefix = type === 'Sales' ? 'SR' : 'PR';
  const count = await ReturnInvoice.countDocuments({ companyId, returnType: type });
  const padded = (count + 1).toString().padStart(4, '0');
  const currentYear = new Date().getFullYear().toString().substring(2);
  return `${prefix}-${currentYear}-${padded}`;
}

exports.createReturn = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { returnType, invoiceNo, originalInvoiceNo, partyId, date, items, taxableAmount, gstAmount, netAmount } = req.body;

    if (!returnType || !partyId || !items || items.length === 0 || !taxableAmount || !netAmount) {
      return res.status(400).json({ success: false, message: 'Type, party, items, and amounts are required' });
    }

    const finalInvoiceNo = invoiceNo || await generateReturnNo(companyId, returnType);

    const returnInvoice = await ReturnInvoice.create({
      companyId,
      returnType,
      invoiceNo: finalInvoiceNo,
      originalInvoiceNo,
      partyId,
      date: date || new Date(),
      items,
      taxableAmount,
      gstAmount: gstAmount || 0,
      netAmount
    });

    // Auto post to Accounting Entry
    try {
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');
      const partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyId);

      const lines = [];

      if (returnType === 'Sales') {
        // Sales Return: Debit Sales A/c, Debit GST Output, Credit Customer Ledger
        const salesLedger = await accountingService.getSystemLedger(companyId, 'Sales A/c');
        const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Output');
        const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Output');

        lines.push({
          ledgerId: salesLedger._id,
          ledgerName: salesLedger.name,
          type: 'Dr',
          amount: parseFloat(taxableAmount),
          narration: `Sales Return for Invoice #${originalInvoiceNo || ''}`
        });

        if (gstAmount > 0) {
          const halfGst = parseFloat((gstAmount / 2).toFixed(2));
          lines.push({
            ledgerId: cgstLedger._id,
            ledgerName: cgstLedger.name,
            type: 'Dr',
            amount: halfGst,
            narration: `CGST Output for Sales Return`
          });
          lines.push({
            ledgerId: sgstLedger._id,
            ledgerName: sgstLedger.name,
            type: 'Dr',
            amount: parseFloat((gstAmount - halfGst).toFixed(2)),
            narration: `SGST Output for Sales Return`
          });
        }

        lines.push({
          ledgerId: partyLedger._id,
          ledgerName: partyLedger.name,
          type: 'Cr',
          amount: parseFloat(netAmount),
          narration: `Return Invoice #${finalInvoiceNo}`
        });

      } else {
        // Purchase Return: Debit Supplier Ledger, Credit Purchase A/c, Credit GST Input
        const purchaseLedger = await accountingService.getSystemLedger(companyId, 'Purchase A/c');
        const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Input');
        const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Input');

        lines.push({
          ledgerId: partyLedger._id,
          ledgerName: partyLedger.name,
          type: 'Dr',
          amount: parseFloat(netAmount),
          narration: `Purchase Return Invoice #${finalInvoiceNo}`
        });

        lines.push({
          ledgerId: purchaseLedger._id,
          ledgerName: purchaseLedger.name,
          type: 'Cr',
          amount: parseFloat(taxableAmount),
          narration: `Purchase Return for Invoice #${originalInvoiceNo || ''}`
        });

        if (gstAmount > 0) {
          const halfGst = parseFloat((gstAmount / 2).toFixed(2));
          lines.push({
            ledgerId: cgstLedger._id,
            ledgerName: cgstLedger.name,
            type: 'Cr',
            amount: halfGst,
            narration: `CGST Input for Purchase Return`
          });
          lines.push({
            ledgerId: sgstLedger._id,
            ledgerName: sgstLedger.name,
            type: 'Cr',
            amount: parseFloat((gstAmount - halfGst).toFixed(2)),
            narration: `SGST Input for Purchase Return`
          });
        }
      }

      await AccountingEntry.create({
        companyId,
        entryNo,
        entryDate: date || new Date(),
        voucherType: returnType === 'Sales' ? 'SalesAuto' : 'PurchaseAuto',
        refType: returnType === 'Sales' ? 'SalesInvoice' : 'PurchaseBill',
        refId: returnInvoice._id,
        lines,
        narration: `Auto posted Return Invoice #${finalInvoiceNo}`
      });

    } catch (acctErr) {
      console.error('Failed to auto post ledger entry for return invoice:', acctErr);
    }

    res.status(201).json({ success: true, data: returnInvoice });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A return with this number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReturns = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { returnType } = req.query;

    const filter = { companyId };
    if (returnType) {
      filter.returnType = returnType;
    }

    const list = await ReturnInvoice.find(filter).populate('partyId').populate('items.itemId').sort({ date: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
