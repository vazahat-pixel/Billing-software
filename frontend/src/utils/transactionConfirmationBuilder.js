/**
 * Builds transaction confirmation data for displaying after successful saves
 * Centralizes logic for creating consistent confirmation UX across transaction types
 */

export const buildPurchaseConfirmation = (purchase, warehouse, item) => {
  const totalQty = purchase.items?.reduce((sum, i) => sum + (i.mts || 0), 0) || 0;
  const warehouseName = warehouse?.name || 'Main Warehouse';

  return {
    title: '✓ PURCHASE COMPLETED',
    message: `Stock added to inventory and ready for use`,
    details: [
      { label: 'Quantity Purchased', value: `${totalQty.toLocaleString()} meters` },
      { label: 'Warehouse', value: warehouseName },
      { label: 'Supplier', value: purchase.supplierName || purchase.supplierId },
      { label: 'Invoice #', value: purchase.invoiceNo },
      { label: 'Status', value: '✓ Ready' },
    ],
    quickActions: [
      { label: 'View Stock', variant: 'primary', key: 'view-stock' },
      { label: 'View Warehouse', variant: 'secondary', key: 'view-warehouse' },
      { label: 'View Supplier', variant: 'secondary', key: 'view-party' },
    ],
  };
};

export const buildSaleConfirmation = (sale, lots = []) => {
  const totalQty = sale.items?.reduce((sum, i) => sum + (i.mts || 0), 0) || 0;
  const remainingStock = lots.reduce((sum, lot) => sum + (lot.remainingMtrs || 0), 0);

  return {
    title: '✓ SALE COMPLETED',
    message: `Stock deducted from warehouse`,
    details: [
      { label: 'Quantity Sold', value: `${totalQty.toLocaleString()} meters` },
      { label: 'Customer', value: sale.customerName || sale.customerId },
      { label: 'Invoice #', value: sale.invoiceNo },
      { label: 'Remaining Stock', value: `${remainingStock.toLocaleString()} meters` },
      { label: 'Status', value: '✓ Completed' },
    ],
    quickActions: [
      { label: 'View Updated Stock', variant: 'primary', key: 'view-stock' },
      { label: 'View Customer Ledger', variant: 'secondary', key: 'view-party' },
      { label: 'Print Invoice', variant: 'secondary', key: 'print' },
    ],
  };
};

export const buildJobIssueConfirmation = (job, sourceLot, warehouse) => {
  const warehouseName = warehouse?.name || 'Main Warehouse';

  return {
    title: '✓ JOB MATERIAL ISSUED',
    message: `Material moved to job worker and tracking is active`,
    details: [
      { label: 'Material Quantity', value: `${(job.issueQty || 0).toLocaleString()} meters` },
      { label: 'Destination', value: job.workerName || 'Job Worker' },
      { label: 'Process', value: job.processType || 'Processing' },
      { label: 'Status', value: '📍 In Transit' },
      { label: 'Warehouse Remaining', value: `${((sourceLot?.remainingMtrs || 0) - (job.issueQty || 0)).toLocaleString()} meters` },
    ],
    quickActions: [
      { label: 'View Pending Materials', variant: 'primary', key: 'view-pending' },
      { label: 'View Material Status', variant: 'secondary', key: 'view-material' },
      { label: 'View Worker Ledger', variant: 'secondary', key: 'view-party' },
    ],
  };
};

export const buildJobReceiveConfirmation = (job, finishedLot) => {
  const wastage = (job.issueQty || 0) - (job.receivedQty || 0);
  const wastagePercent = job.issueQty > 0 ? ((wastage / job.issueQty) * 100).toFixed(2) : 0;

  return {
    title: '✓ JOB MATERIAL RECEIVED',
    message: `Material received and new lot created`,
    details: [
      { label: 'Original Quantity', value: `${(job.issueQty || 0).toLocaleString()} meters` },
      { label: 'Received Quantity', value: `${(job.receivedQty || 0).toLocaleString()} meters` },
      { label: 'Wastage', value: `${wastage.toLocaleString()}m (${wastagePercent}%)` },
      { label: 'Finished Material', value: finishedLot?.itemName || 'New Item' },
      { label: 'New Lot Created', value: finishedLot?.lotId || 'Lot Tracking Active' },
    ],
    quickActions: [
      { label: 'View Finished Stock', variant: 'primary', key: 'view-stock' },
      { label: 'View Process History', variant: 'secondary', key: 'view-history' },
      { label: 'View Job Details', variant: 'secondary', key: 'view-job' },
    ],
  };
};

export const buildPaymentConfirmation = (payment, party) => {
  const previousOutstanding = (payment.partyOutstandingBefore || 0);
  const newOutstanding = (payment.partyOutstandingAfter || 0);

  return {
    title: '✓ PAYMENT COMPLETED',
    message: `Payment recorded and outstanding reduced`,
    details: [
      { label: 'Amount Paid', value: `₹${(payment.amount || 0).toLocaleString('en-IN')}` },
      { label: 'Payment Mode', value: payment.paymentMode || 'Cash' },
      { label: 'Party', value: party?.name || payment.partyName },
      { label: 'Previous Outstanding', value: `₹${previousOutstanding.toLocaleString('en-IN')}` },
      { label: 'New Outstanding', value: `₹${newOutstanding.toLocaleString('en-IN')}` },
    ],
    quickActions: [
      { label: 'View Party Ledger', variant: 'primary', key: 'view-party' },
      { label: 'View Bank Book', variant: 'secondary', key: 'view-bank-book' },
      { label: 'View Outstanding', variant: 'secondary', key: 'view-outstanding' },
    ],
  };
};

export const buildReceiptConfirmation = (receipt, party) => {
  const previousOutstanding = (receipt.partyOutstandingBefore || 0);
  const newOutstanding = (receipt.partyOutstandingAfter || 0);

  return {
    title: '✓ RECEIPT COMPLETED',
    message: `Receipt recorded and customer outstanding reduced`,
    details: [
      { label: 'Amount Received', value: `₹${(receipt.amount || 0).toLocaleString('en-IN')}` },
      { label: 'Receipt Mode', value: receipt.paymentMode || 'Cash' },
      { label: 'Customer', value: party?.name || receipt.partyName },
      { label: 'Previous Outstanding', value: `₹${previousOutstanding.toLocaleString('en-IN')}` },
      { label: 'New Outstanding', value: `₹${newOutstanding.toLocaleString('en-IN')}` },
    ],
    quickActions: [
      { label: 'View Customer Ledger', variant: 'primary', key: 'view-party' },
      { label: 'View Bank Book', variant: 'secondary', key: 'view-bank-book' },
      { label: 'View Outstanding', variant: 'secondary', key: 'view-outstanding' },
    ],
  };
};

export default {
  buildPurchaseConfirmation,
  buildSaleConfirmation,
  buildJobIssueConfirmation,
  buildJobReceiveConfirmation,
  buildPaymentConfirmation,
  buildReceiptConfirmation,
};
