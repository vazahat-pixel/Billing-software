const LedgerMaster = require('../models/LedgerMaster');
const AccountingEntry = require('../models/AccountingEntry');
const Party = require('../models/Party');
const Counter = require('../models/Counter');

const SYSTEM_LEDGER_TEMPLATES = [
  { name: 'Cash A/c', group: 'Assets', subGroup: 'Cash & Bank' },
  { name: 'Bank A/c', group: 'Assets', subGroup: 'Cash & Bank' },
  { name: 'Sales A/c', group: 'Income', subGroup: 'Direct Income' },
  { name: 'Purchase A/c', group: 'Expenses', subGroup: 'Direct Expenses' },
  { name: 'CGST Input', group: 'Assets', subGroup: 'Tax' },
  { name: 'SGST Input', group: 'Assets', subGroup: 'Tax' },
  { name: 'IGST Input', group: 'Assets', subGroup: 'Tax' },
  { name: 'CGST Output', group: 'Liabilities', subGroup: 'Tax' },
  { name: 'SGST Output', group: 'Liabilities', subGroup: 'Tax' },
  { name: 'IGST Output', group: 'Liabilities', subGroup: 'Tax' },
  { name: 'Job Work Charges', group: 'Expenses', subGroup: 'Direct Expenses' },
  { name: 'Production Loss A/c', group: 'Expenses', subGroup: 'Direct Expenses' },
  { name: 'Stock A/c', group: 'Assets', subGroup: 'Current Assets' },
  { name: 'Freight Charges', group: 'Expenses', subGroup: 'Indirect Expenses' },
  { name: 'Capital A/c', group: 'Capital', subGroup: "Owner's Capital" },
  { name: 'Retained Earnings', group: 'Capital', subGroup: 'Retained Earnings' },
  { name: 'GRN Clearing A/c', group: 'Liabilities', subGroup: 'Current Liabilities' },
  { name: 'Sales Return A/c', group: 'Income', subGroup: 'Direct Income' },
  { name: 'Purchase Return A/c', group: 'Expenses', subGroup: 'Direct Expenses' },
  { name: 'Round Off', group: 'Expenses', subGroup: 'Indirect Expenses' },
];

class AccountingService {
  // Pre-seed system ledgers for a company (delegates to Stage 3 CoA engine)
  async seedSystemLedgers(companyId) {
    const chartOfAccounts = require('./chartOfAccountsService');
    return chartOfAccounts.seedSystemLedgers(companyId);
  }

  // Get or auto-create system ledger
  async getSystemLedger(companyId, name) {
    let ledger = await LedgerMaster.findOne({ companyId, name });
    if (!ledger) {
      const template = SYSTEM_LEDGER_TEMPLATES.find(t => t.name === name) || {
        name,
        group: 'Expenses',
        subGroup: 'General'
      };
      ledger = await LedgerMaster.create({
        companyId,
        ...template,
        isSystemLedger: true
      });
    }
    return ledger;
  }

  // Get or auto-create party ledger
  async getOrCreatePartyLedger(companyId, partyId) {
    let ledger = await LedgerMaster.findOne({ companyId, linkedPartyId: partyId });
    if (!ledger) {
      const party = await Party.findOne({ _id: partyId, companyId });
      if (!party) {
        throw new Error(`Party with ID ${partyId} not found`);
      }
      // Fix: 'Both' type parties are treated as Supplier (Creditor)
      const isCreditor = ['Supplier', 'Both', 'Job Worker', 'Broker', 'Transport', 'Agent'].includes(party.type);
      const group = isCreditor ? 'Liabilities' : 'Assets';
      const subGroup = isCreditor ? 'Sundry Creditors' : 'Sundry Debtors';

      ledger = await LedgerMaster.create({
        companyId,
        name: party.name,
        group,
        subGroup,
        linkedPartyId: partyId,
        accountType: 'Party',
        nature: isCreditor ? 'Cr' : 'Dr',
        openingBalance: party.openingBalance || 0,
        openingBalanceType: party.openingBalanceType || (isCreditor ? 'Cr' : 'Dr')
      });
    }
    return ledger;
  }

  /**
   * FIXED: Uses atomic Counter model to prevent race conditions.
   * Old: countDocuments + 1 (duplicate keys under concurrency)
   * New: MongoDB atomic $inc
   */
  async generateEntryNo(companyId, prefix, session = null) {
    const currentYear = new Date().getFullYear().toString().substring(2);
    const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
    const fy = `${currentYear}-${nextYear}`;
    const counterId = `${prefix}-${fy}-${companyId}`;
    const seq = await Counter.nextSeq(counterId, session);
    return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
  }

  // 1. Sales Invoice posting — FIXED: re-throws errors, supports sessions
  async onSalesInvoicePost(invoice, session = null) {
    try {
      const companyId = invoice.companyId;
      const entryNo = await this.generateEntryNo(companyId, 'JNL', session);

      const customerLedger = await this.getOrCreatePartyLedger(companyId, invoice.customerId);
      const salesLedger = await this.getSystemLedger(companyId, 'Sales A/c');
      const cgstLedger = await this.getSystemLedger(companyId, 'CGST Output');
      const sgstLedger = await this.getSystemLedger(companyId, 'SGST Output');
      const igstLedger = await this.getSystemLedger(companyId, 'IGST Output');

      const round2 = (n) => Number(Number(n || 0).toFixed(2));
      const netAmount = round2(invoice.netAmount);
      const taxableAmount = round2(invoice.taxableAmount);
      const cgst = round2(invoice.cgst || invoice.totals?.cgst);
      const sgst = round2(invoice.sgst || invoice.totals?.sgst);
      const igst = round2(invoice.igst || invoice.totals?.igst);
      const roundOff = round2(invoice.roundOff);

      const lines = [
        {
          ledgerId: customerLedger._id,
          ledgerName: customerLedger.name,
          type: 'Dr',
          amount: netAmount,
          narration: `Sales Invoice #${invoice.invoiceNo}`
        },
        {
          ledgerId: salesLedger._id,
          ledgerName: salesLedger.name,
          type: 'Cr',
          amount: taxableAmount,
          narration: `Sales value for Invoice #${invoice.invoiceNo}`
        }
      ];

      if (cgst > 0) lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Cr', amount: cgst, narration: `CGST Output #${invoice.invoiceNo}` });
      if (sgst > 0) lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Cr', amount: sgst, narration: `SGST Output #${invoice.invoiceNo}` });
      if (igst > 0) lines.push({ ledgerId: igstLedger._id, ledgerName: igstLedger.name, type: 'Cr', amount: igst, narration: `IGST Output #${invoice.invoiceNo}` });

      if (Math.abs(roundOff) >= 0.01) {
        const roundLedger = await this.getSystemLedger(companyId, 'Round Off');
        // Sales: net = taxable + gst + roundOff → opposite purchase sides
        if (roundOff > 0) {
          lines.push({ ledgerId: roundLedger._id, ledgerName: roundLedger.name, type: 'Cr', amount: Math.abs(roundOff), narration: `Round off #${invoice.invoiceNo}` });
        } else {
          lines.push({ ledgerId: roundLedger._id, ledgerName: roundLedger.name, type: 'Dr', amount: Math.abs(roundOff), narration: `Round off #${invoice.invoiceNo}` });
        }
      }
      const data = { companyId, entryNo, entryDate: invoice.date || new Date(), voucherType: 'SalesAuto', refType: 'SalesInvoice', refId: invoice._id, lines, narration: `Auto posted Sales Invoice #${invoice.invoiceNo}` };
      const entry = session ? await AccountingEntry.create([data], { session }) : await AccountingEntry.create(data);
      return Array.isArray(entry) ? entry[0] : entry;
    } catch (err) {
      console.error('Failed auto sales posting:', err);
      throw err; // Re-throw — caller should handle rollback
    }
  }

  // 2. Purchase Bill posting — FIXED: standardized field names, supports sessions
  async onPurchaseBillPost(bill, session = null) {
    try {
      const companyId = bill.companyId;
      const entryNo = await this.generateEntryNo(companyId, 'JNL', session);

      const supplierLedger = await this.getOrCreatePartyLedger(companyId, bill.supplierId);
      const purchaseLedger = await this.getSystemLedger(companyId, 'Purchase A/c');
      const cgstLedger = await this.getSystemLedger(companyId, 'CGST Input');
      const sgstLedger = await this.getSystemLedger(companyId, 'SGST Input');
      const igstLedger = await this.getSystemLedger(companyId, 'IGST Input');

      const round2 = (n) => Number(Number(n || 0).toFixed(2));
      const netAmount = round2(bill.netAmount);
      const taxableAmount = round2(bill.taxableAmount);
      const cgst = round2(bill.cgst || bill.totals?.cgst);
      const sgst = round2(bill.sgst || bill.totals?.sgst);
      const igst = round2(bill.igst || bill.totals?.igst);
      const roundOff = round2(bill.roundOff);

      const lines = [
        { ledgerId: purchaseLedger._id, ledgerName: purchaseLedger.name, type: 'Dr', amount: taxableAmount, narration: `Purchase value for Bill #${bill.invoiceNo}` }
      ];

      if (cgst > 0) lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Dr', amount: cgst, narration: `CGST Input #${bill.invoiceNo}` });
      if (sgst > 0) lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Dr', amount: sgst, narration: `SGST Input #${bill.invoiceNo}` });
      if (igst > 0) lines.push({ ledgerId: igstLedger._id, ledgerName: igstLedger.name, type: 'Dr', amount: igst, narration: `IGST Input #${bill.invoiceNo}` });

      // Round off bridges taxable+GST vs net (e.g. Harshika bill −0.20)
      if (Math.abs(roundOff) >= 0.01) {
        const roundLedger = await this.getSystemLedger(companyId, 'Round Off');
        if (roundOff > 0) {
          lines.push({
            ledgerId: roundLedger._id,
            ledgerName: roundLedger.name,
            type: 'Dr',
            amount: Math.abs(roundOff),
            narration: `Round off #${bill.invoiceNo}`,
          });
        } else {
          lines.push({
            ledgerId: roundLedger._id,
            ledgerName: roundLedger.name,
            type: 'Cr',
            amount: Math.abs(roundOff),
            narration: `Round off #${bill.invoiceNo}`,
          });
        }
      }

      lines.push({ ledgerId: supplierLedger._id, ledgerName: supplierLedger.name, type: 'Cr', amount: netAmount, narration: `Purchase Bill #${bill.invoiceNo}` });

      // Safety: absorb residual float (≤ ₹1) into Round Off so Save never fails on 0.01–0.02 drifts
      let dr = 0;
      let cr = 0;
      lines.forEach((l) => {
        if (l.type === 'Dr') dr += l.amount;
        else cr += l.amount;
      });
      const gap = round2(dr - cr);
      if (Math.abs(gap) >= 0.01 && Math.abs(gap) <= 1) {
        const roundLedger = await this.getSystemLedger(companyId, 'Round Off');
        if (gap > 0) {
          lines.push({
            ledgerId: roundLedger._id,
            ledgerName: roundLedger.name,
            type: 'Cr',
            amount: Math.abs(gap),
            narration: `Balance adjust #${bill.invoiceNo}`,
          });
        } else {
          lines.push({
            ledgerId: roundLedger._id,
            ledgerName: roundLedger.name,
            type: 'Dr',
            amount: Math.abs(gap),
            narration: `Balance adjust #${bill.invoiceNo}`,
          });
        }
      }

      const data = { companyId, entryNo, entryDate: bill.date || new Date(), voucherType: 'PurchaseAuto', refType: 'PurchaseBill', refId: bill._id, lines, narration: `Auto posted Purchase Bill #${bill.invoiceNo}` };
      const entry = session ? await AccountingEntry.create([data], { session }) : await AccountingEntry.create(data);
      return Array.isArray(entry) ? entry[0] : entry;
    } catch (err) {
      console.error('Failed auto purchase posting:', err);
      throw err;
    }
  }

  // 3. GRN posting
  async onGRNPost(grn) {
    try {
      const companyId = grn.companyId;
      const entryNo = await this.generateEntryNo(companyId, 'JNL');
      const stockLedger = await this.getSystemLedger(companyId, 'Stock A/c');
      const clearingLedger = await this.getSystemLedger(companyId, 'GRN Clearing A/c');
      const totalAmount = parseFloat(grn.totalAmount || grn.amount || 0);
      const lines = [
        { ledgerId: stockLedger._id, ledgerName: stockLedger.name, type: 'Dr', amount: totalAmount, narration: `Stock receipt GRN #${grn.grnNo || grn._id}` },
        { ledgerId: clearingLedger._id, ledgerName: clearingLedger.name, type: 'Cr', amount: totalAmount, narration: `Clearing provision GRN #${grn.grnNo || grn._id}` }
      ];
      return await AccountingEntry.create({ companyId, entryNo, entryDate: grn.date || new Date(), voucherType: 'PurchaseAuto', refType: 'GRN', refId: grn._id, lines, narration: `Auto posted GRN #${grn.grnNo || grn._id}` });
    } catch (err) {
      console.error('Failed auto GRN posting:', err);
    }
  }

  // 4. GRN linked to Purchase Bill
  async onPurchaseBillLinkedToGRN(bill) {
    try {
      const companyId = bill.companyId;
      const entryNo = await this.generateEntryNo(companyId, 'JNL');
      const clearingLedger = await this.getSystemLedger(companyId, 'GRN Clearing A/c');
      const purchaseLedger = await this.getSystemLedger(companyId, 'Purchase A/c');
      const cgstLedger = await this.getSystemLedger(companyId, 'CGST Input');
      const sgstLedger = await this.getSystemLedger(companyId, 'SGST Input');

      const amount = parseFloat(bill.taxableAmount || 0);
      const cgst = parseFloat(bill.cgst || 0);
      const sgst = parseFloat(bill.sgst || 0);

      const lines = [
        { ledgerId: clearingLedger._id, ledgerName: clearingLedger.name, type: 'Dr', amount: amount, narration: `GRN Clearing for Bill #${bill.invoiceNo}` },
        { ledgerId: purchaseLedger._id, ledgerName: purchaseLedger.name, type: 'Cr', amount: amount - cgst - sgst, narration: `Reversal of purchase clearing` }
      ];
      if (cgst > 0) lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Cr', amount: cgst, narration: `CGST Input adjustment` });
      if (sgst > 0) lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Cr', amount: sgst, narration: `SGST Input adjustment` });

      return await AccountingEntry.create({ companyId, entryNo, entryDate: bill.date || new Date(), voucherType: 'PurchaseAuto', refType: 'PurchaseBill', refId: bill._id, lines, narration: `Auto posted Linked Bill GRN #${bill.invoiceNo}` });
    } catch (err) {
      console.error('Failed auto purchase linked GRN posting:', err);
    }
  }

  // 5. Job Work Charges — FIXED: Split GST correctly into CGST+SGST or IGST based on location
  async onJobWorkChargesPost(receive, session = null) {
    try {
      const companyId = receive.companyId;
      const entryNo = await this.generateEntryNo(companyId, 'JNL', session);

      const jobChargesLedger = await this.getSystemLedger(companyId, 'Job Work Charges');
      const cgstInputLedger = await this.getSystemLedger(companyId, 'CGST Input');
      const sgstInputLedger = await this.getSystemLedger(companyId, 'SGST Input');
      const igstInputLedger = await this.getSystemLedger(companyId, 'IGST Input');
      const millLedger = await this.getOrCreatePartyLedger(companyId, receive.millId);

      const charges = parseFloat(receive.charges || receive.totalAmount || 0);
      const totalGst = parseFloat(receive.gstAmount || 0);
      const halfGst = parseFloat((totalGst / 2).toFixed(2));
      const otherHalfGst = parseFloat((totalGst - halfGst).toFixed(2));
      const total = charges + totalGst;

      // Determine GST Type (CGST+SGST or IGST)
      const millParty = await Party.findById(receive.millId);
      const CompanySettings = require('../models/CompanySettings');
      const companySettings = await CompanySettings.findOne({ companyId });
      
      let isInterState = false;
      if (millParty && millParty.gstin && companySettings && companySettings.gstin) {
        const millStateCode = millParty.gstin.substring(0, 2);
        const companyStateCode = companySettings.gstin.substring(0, 2);
        if (millStateCode !== companyStateCode) {
          isInterState = true;
        }
      } else if (millParty && millParty.state && companySettings && companySettings.state) {
        if (millParty.state.toLowerCase() !== companySettings.state.toLowerCase()) {
          isInterState = true;
        }
      }

      const lines = [
        { ledgerId: jobChargesLedger._id, ledgerName: jobChargesLedger.name, type: 'Dr', amount: charges, narration: 'Job Work Charges on Receipt' }
      ];

      if (totalGst > 0) {
        if (isInterState) {
          lines.push({ ledgerId: igstInputLedger._id, ledgerName: igstInputLedger.name, type: 'Dr', amount: totalGst, narration: 'IGST Input on Job Work' });
        } else {
          if (halfGst > 0) lines.push({ ledgerId: cgstInputLedger._id, ledgerName: cgstInputLedger.name, type: 'Dr', amount: halfGst, narration: 'CGST Input on Job Work' });
          if (otherHalfGst > 0) lines.push({ ledgerId: sgstInputLedger._id, ledgerName: sgstInputLedger.name, type: 'Dr', amount: otherHalfGst, narration: 'SGST Input on Job Work' });
        }
      }

      lines.push({ ledgerId: millLedger._id, ledgerName: millLedger.name, type: 'Cr', amount: total, narration: 'Job Work Payable to Mill' });

      const data = { companyId, entryNo, entryDate: receive.date || new Date(), voucherType: 'JobWorkAuto', refType: 'JobReceive', refId: receive._id, lines, narration: 'Auto posted Job Work Charges' };
      if (session) {
        const entry = await AccountingEntry.create([data], { session });
        return entry[0];
      }
      return await AccountingEntry.create(data);
    } catch (err) {
      console.error('Failed auto job work charges posting:', err);
      if (session) throw err;
    }
  }

  // 6. Abnormal Wastage posting — costPerUnit now passed from actual lot data
  async onAbnormalWastagePost(companyId, qty, costPerUnit, refId = null, session = null) {
    try {
      const entryNo = await this.generateEntryNo(companyId, 'JNL', session);
      const lossLedger = await this.getSystemLedger(companyId, 'Production Loss A/c');
      const stockLedger = await this.getSystemLedger(companyId, 'Stock A/c');
      const amount = Number((parseFloat(qty) * parseFloat(costPerUnit)).toFixed(2));

      const lines = [
        { ledgerId: lossLedger._id, ledgerName: lossLedger.name, type: 'Dr', amount, narration: `Abnormal wastage loss (${qty} units @ ₹${costPerUnit}/unit)` },
        { ledgerId: stockLedger._id, ledgerName: stockLedger.name, type: 'Cr', amount, narration: 'Stock reduction for wastage' }
      ];

      const data = { companyId, entryNo, entryDate: new Date(), voucherType: 'WastageAuto', refType: 'Journal', refId, lines, narration: 'Auto posted Abnormal Wastage Entry' };
      if (session) {
        const entry = await AccountingEntry.create([data], { session });
        return entry[0];
      }
      return await AccountingEntry.create(data);
    } catch (err) {
      console.error('Failed auto wastage posting:', err);
      if (session) throw err;
    }
  }
}

module.exports = new AccountingService();
