/**
 * Canonical default dynamic config for Textile ERP (Phase 0 audit).
 * Seeded per company on registration / admin company create.
 */

const DEFAULT_MODULES = {
  sales: true,
  purchase: true,
  jobWork: true,
  accounting: true,
  gst: true,
  inventory: true,
  reports: true,
  masters: true,
  utilities: true
};

const DEFAULT_SUB_MENUS = {
  sales: {
    'Sales Billing': true,
    'Sales Order': true,
    'Sales Return': true,
    'Debit/Credit Note': true,
    'Visit Log': true,
    'Outstanding': true
  },
  purchase: {
    'Purchase Bill': true,
    'Purchase Order': true,
    'Purchase Return': true,
    'Job Purchase': true
  },
  jobWork: {
    'Mill Issue': true,
    'Mill Receive': true,
    'Job Issue': true,
    'Job Receive': true,
    'Update Job': true
  },
  accounting: {
    'Bank Receipt': true,
    'Bank Payment': true,
    'Cash Book': true,
    'Journal (GST)': true,
    'Opening Balance': true
  },
  gst: {
    'GSTR-1': true,
    'GSTR-2B Matching': true,
    'GST 3B Monthly': true,
    'GST Compliance': true,
    'CA Desk': true
  },
  inventory: {
    'Stock Ledger': true,
    'Lot Details': true
  },
  reports: {
    'Outstanding Report': true,
    'Sales Outstanding': true,
    'Inventory Stock': true
  },
  masters: {
    'Account Master': true,
    'Item Master': true,
    'Book Master': true,
    'Opening Stock': true
  }
};

const DEFAULT_MODULE_FIELDS = {
  sales: { broker: true, challan: true, bale: false, weight: false, lrNo: true },
  purchase: { broker: true, discount2: true, lrNo: true, vehicleNo: false, extraCharges: false },
  jobWork: { processType: true, ratePerMeter: false, wastage: false },
  accounting: { splitPayment: true, chequeNo: true, utrNo: true }
};

const SALES_BILL_CONFIG = {
  billType: 'sales',
  label: 'Sales Invoice',
  headerFields: [
    { key: 'party', label: 'Party', type: 'searchable-select', section: 'header', required: true, visible: true, order: 1 },
    { key: 'billNo', label: 'Bill No', type: 'readonly', section: 'header', required: false, visible: true, readOnly: true, order: 2 },
    { key: 'billDate', label: 'Bill Date', type: 'date', section: 'header', required: true, visible: true, order: 3 },
    { key: 'challanNo', label: 'Challan No', type: 'text', section: 'header', required: false, visible: true, order: 4 },
    { key: 'chDate', label: 'Challan Date', type: 'date', section: 'header', required: false, visible: true, order: 5 },
    { key: 'orderNo', label: 'Order No', type: 'text', section: 'header', required: false, visible: true, order: 6 },
    { key: 'orderDate', label: 'Order Date', type: 'date', section: 'header', required: false, visible: true, order: 7 },
    { key: 'broker', label: 'Broker', type: 'select', section: 'header', required: false, visible: true, order: 8 },
    { key: 'haste', label: 'Haste', type: 'text', section: 'header', required: false, visible: true, order: 9 },
    { key: 'type', label: 'Invoice Type', type: 'select', section: 'header', required: true, visible: true, order: 10,
      options: [
        { value: 'INVOICE IN STATE', label: 'INVOICE IN STATE' },
        { value: 'INVOICE OUT OF STATE', label: 'INVOICE OUT OF STATE' }
      ]
    }
  ],
  lineColumns: [
    { key: 'itemId', label: 'Item Name', visible: true, order: 1, width: 'w-40' },
    { key: 'desc', label: 'Desc', visible: true, order: 2, width: 'w-24' },
    { key: 'fold', label: 'Fold', visible: true, order: 3, width: 'w-16', calculated: true },
    { key: 'cut', label: 'Cut', visible: true, order: 4, width: 'w-16', calculated: true },
    { key: 'pcs', label: 'Pcs', visible: true, order: 5, width: 'w-16' },
    { key: 'mts', label: 'Mts', visible: true, order: 6, width: 'w-20', calculated: true },
    { key: 'saleRate', label: 'Rate', visible: true, order: 7, width: 'w-20' },
    { key: 'amount', label: 'Amount', visible: true, order: 8, width: 'w-24', calculated: true },
    { key: 'dis1Per', label: 'DIS1%', visible: true, order: 9, width: 'w-16' },
    { key: 'dis1Amt', label: 'DISAM', visible: true, order: 10, width: 'w-20', calculated: true },
    { key: 'lotId', label: 'Lot', visible: true, order: 11, width: 'w-24' }
  ],
  footerFields: [
    { key: 'foldLess', label: 'Fold Less', type: 'number', section: 'footer', visible: true, order: 1 },
    { key: 'rdAmt', label: 'RD Amt', type: 'number', section: 'footer', visible: true, order: 2 },
    { key: 'discountAmt', label: 'Discount', type: 'number', section: 'footer', visible: true, order: 3 },
    { key: 'lessAmt', label: 'Less', type: 'number', section: 'footer', visible: true, order: 4 },
    { key: 'addAmt', label: 'Add', type: 'number', section: 'footer', visible: true, order: 5 },
    { key: 'tcs', label: 'TCS', type: 'number', section: 'footer', visible: true, order: 6 },
    { key: 'transport', label: 'Transport', type: 'text', section: 'footer', visible: true, order: 7 },
    { key: 'lrNo', label: 'LR No', type: 'text', section: 'footer', visible: true, order: 8 },
    { key: 'bale', label: 'Bale', type: 'number', section: 'footer', visible: false, order: 9 },
    { key: 'weight', label: 'Weight', type: 'number', section: 'footer', visible: false, order: 10 }
  ],
  calculations: {
    taxableFormula: 'sum(line.amount) - footer.discounts',
    gstTypeField: 'type',
    netAmountFormula: 'taxable + gst + tcs + add - less + roundOff'
  },
  printTemplate: { templateId: 'classic-ledger', showLogo: true, watermark: false }
};

const PURCHASE_BILL_CONFIG = {
  billType: 'purchase',
  label: 'Purchase Bill',
  headerFields: [
    { key: 'party', label: 'Vendor', type: 'searchable-select', section: 'header', required: true, visible: true, order: 1 },
    { key: 'vNo', label: 'Voucher No', type: 'readonly', section: 'header', readOnly: true, visible: true, order: 2 },
    { key: 'billDate', label: 'Date', type: 'date', section: 'header', required: true, visible: true, order: 3 },
    { key: 'billNo', label: 'Supp. Bill', type: 'text', section: 'header', visible: true, order: 4 },
    { key: 'challanNo', label: 'Challan No', type: 'text', section: 'header', visible: true, order: 5 },
    { key: 'chDate', label: 'Challan Date', type: 'date', section: 'header', visible: true, order: 6 },
    { key: 'broker', label: 'Broker', type: 'select', section: 'header', visible: true, order: 7 },
    { key: 'reverseCharge', label: 'RCM', type: 'select', section: 'header', visible: true, order: 8,
      options: [{ value: 'N', label: 'No' }, { value: 'Y', label: 'Yes' }]
    },
    { key: 'type', label: 'Invoice Type', type: 'select', section: 'header', required: true, visible: true, order: 9,
      options: [
        { value: 'INVOICE IN STATE', label: 'INVOICE IN STATE' },
        { value: 'INVOICE OUT OF STATE', label: 'INVOICE OUT OF STATE' }
      ]
    }
  ],
  lineColumns: [
    { key: 'itemId', label: 'Item', visible: true, order: 1 },
    { key: 'desc', label: 'Desc', visible: true, order: 2 },
    { key: 'fold', label: 'Fold', visible: true, order: 3, calculated: true },
    { key: 'cut', label: 'Cut', visible: true, order: 4, calculated: true },
    { key: 'pcs', label: 'Pcs', visible: true, order: 5 },
    { key: 'mts', label: 'Mts', visible: true, order: 6, calculated: true },
    { key: 'rate', label: 'Rate', visible: true, order: 7 },
    { key: 'amount', label: 'Amount', visible: true, order: 8, calculated: true },
    { key: 'dis1Per', label: 'DIS1%', visible: true, order: 9 },
    { key: 'dis1Amt', label: 'DIS1Amt', visible: true, order: 10, calculated: true },
    { key: 'dis2Per', label: 'DIS2%', visible: true, order: 11 },
    { key: 'dis2Amt', label: 'DIS2Amt', visible: true, order: 12, calculated: true },
    { key: 'gstPer', label: 'GST%', visible: true, order: 13 },
    { key: 'gstAmt', label: 'GSTAmt', visible: true, order: 14, calculated: true }
  ],
  footerFields: [
    { key: 'discountAmt', label: 'Discount', type: 'number', section: 'footer', visible: true, order: 1 },
    { key: 'lessAmt', label: 'Less', type: 'number', section: 'footer', visible: true, order: 2 },
    { key: 'addAmt', label: 'Add', type: 'number', section: 'footer', visible: true, order: 3 },
    { key: 'octroi', label: 'Octroi', type: 'number', section: 'footer', visible: true, order: 4 },
    { key: 'itcEligibility', label: 'ITC Eligibility', type: 'select', section: 'footer', visible: true, order: 5 }
  ],
  calculations: {
    taxableFormula: 'sum(line.amount) - footer.discounts',
    gstTypeField: 'type',
    netAmountFormula: 'taxable + gst + rcm + add - less + roundOff'
  },
  printTemplate: { templateId: 'classic-ledger', showLogo: true, watermark: false }
};

const MILL_ISSUE_BILL_CONFIG = {
  billType: 'millIssue',
  label: 'Mill Issue',
  headerFields: [
    { key: 'workerId', label: 'Mill Party', type: 'select', section: 'header', required: true, visible: true, order: 1 },
    { key: 'gstin', label: 'GSTIN', type: 'readonly', section: 'header', visible: true, order: 2 },
    { key: 'address', label: 'City', type: 'readonly', section: 'header', visible: true, order: 3 },
    { key: 'processType', label: 'Process', type: 'select', section: 'header', required: true, visible: true, order: 4 },
    { key: 'broker', label: 'Broker', type: 'text', section: 'header', visible: true, order: 5 },
    { key: 'challanNo', label: 'Challan', type: 'text', section: 'header', visible: true, order: 6 },
    { key: 'date', label: 'Date', type: 'date', section: 'header', required: true, visible: true, order: 7 },
    { key: 'reFinish', label: 'Re-Finish', type: 'checkbox', section: 'header', visible: true, order: 8 }
  ],
  lineColumns: [
    { key: 'lotId', label: 'Stock Lot', visible: true, order: 1 },
    { key: 'issuePcs', label: 'Issue Pcs', visible: true, order: 2 },
    { key: 'issueQty', label: 'Issue Qty', visible: true, order: 3 },
    { key: 'chargesRate', label: 'Job Rate', visible: true, order: 4 }
  ],
  footerFields: [
    { key: 'transport', label: 'Transport', type: 'text', section: 'footer', visible: true, order: 1 },
    { key: 'lrNo', label: 'LR No', type: 'text', section: 'footer', visible: true, order: 2 },
    { key: 'baleNo', label: 'Bale No', type: 'text', section: 'footer', visible: true, order: 3 },
    { key: 'remark', label: 'Remark', type: 'text', section: 'footer', visible: true, order: 4 }
  ],
  calculations: {},
  printTemplate: { templateId: 'classic-ledger', showLogo: true, watermark: false }
};

const MILL_RECEIVE_BILL_CONFIG = {
  billType: 'millReceive',
  label: 'Mill Receive',
  headerFields: [
    { key: 'workerId', label: 'Mill Party', type: 'select', section: 'header', required: true, visible: true, order: 1 },
    { key: 'processType', label: 'Process', type: 'select', section: 'header', visible: true, order: 2 },
    { key: 'challanNo', label: 'Challan', type: 'text', section: 'header', visible: true, order: 3 },
    { key: 'date', label: 'Date', type: 'date', section: 'header', required: true, visible: true, order: 4 }
  ],
  lineColumns: [
    { key: 'jobCardNo', label: 'Job Card', visible: true, order: 1 },
    { key: 'receiveQty', label: 'Receive Qty', visible: true, order: 2 },
    { key: 'receivePcs', label: 'Receive Pcs', visible: true, order: 3 },
    { key: 'wastage', label: 'Wastage', visible: true, order: 4 },
    { key: 'shortage', label: 'Shortage', visible: true, order: 5 }
  ],
  footerFields: [
    { key: 'transport', label: 'Transport', type: 'text', section: 'footer', visible: true, order: 1 },
    { key: 'lrNo', label: 'LR No', type: 'text', section: 'footer', visible: true, order: 2 },
    { key: 'remark', label: 'Remark', type: 'text', section: 'footer', visible: true, order: 3 }
  ],
  calculations: {},
  printTemplate: { templateId: 'classic-ledger', showLogo: true, watermark: false }
};

const JOB_ISSUE_BILL_CONFIG = {
  billType: 'jobIssue',
  label: 'Job Issue',
  headerFields: [
    { key: 'workerId', label: 'Job Worker', type: 'select', section: 'header', required: true, visible: true, order: 1 },
    { key: 'processType', label: 'Process', type: 'select', section: 'header', visible: true, order: 2 },
    { key: 'challanNo', label: 'Challan', type: 'text', section: 'header', visible: true, order: 3 },
    { key: 'date', label: 'Date', type: 'date', section: 'header', required: true, visible: true, order: 4 }
  ],
  lineColumns: [
    { key: 'lotId', label: 'Lot', visible: true, order: 1 },
    { key: 'issueQty', label: 'Issue Qty', visible: true, order: 2 },
    { key: 'issuePcs', label: 'Issue Pcs', visible: true, order: 3 },
    { key: 'rate', label: 'Rate', visible: false, order: 4 }
  ],
  footerFields: [
    { key: 'transport', label: 'Transport', type: 'text', section: 'footer', visible: true, order: 1 },
    { key: 'remark', label: 'Remark', type: 'text', section: 'footer', visible: true, order: 2 }
  ],
  calculations: {},
  printTemplate: { templateId: 'classic-ledger', showLogo: true, watermark: false }
};

const JOB_RECEIVE_BILL_CONFIG = {
  billType: 'jobReceive',
  label: 'Job Receive',
  headerFields: [
    { key: 'workerId', label: 'Job Worker', type: 'select', section: 'header', required: true, visible: true, order: 1 },
    { key: 'date', label: 'Date', type: 'date', section: 'header', required: true, visible: true, order: 2 }
  ],
  lineColumns: [
    { key: 'jobCardNo', label: 'Job Card', visible: true, order: 1 },
    { key: 'receiveQty', label: 'Receive Qty', visible: true, order: 2 },
    { key: 'receivePcs', label: 'Receive Pcs', visible: true, order: 3 },
    { key: 'wastage', label: 'Wastage', visible: true, order: 4 }
  ],
  footerFields: [
    { key: 'remark', label: 'Remark', type: 'text', section: 'footer', visible: true, order: 1 }
  ],
  calculations: {},
  printTemplate: { templateId: 'classic-ledger', showLogo: true, watermark: false }
};

const DEFAULT_BILL_CONFIGS = [
  SALES_BILL_CONFIG,
  PURCHASE_BILL_CONFIG,
  MILL_ISSUE_BILL_CONFIG,
  MILL_RECEIVE_BILL_CONFIG,
  JOB_ISSUE_BILL_CONFIG,
  JOB_RECEIVE_BILL_CONFIG
];

const DEFAULT_COLUMN_CONFIGS = [
  {
    tableKey: 'records.sales',
    label: 'Sales Invoice List',
    module: 'sales',
    columns: [
      { key: 'invoiceNo', label: 'Invoice No', visible: true, order: 1, sortable: true },
      { key: 'date', label: 'Date', visible: true, order: 2, sortable: true },
      { key: 'party', label: 'Customer', visible: true, order: 3 },
      { key: 'total', label: 'Total', visible: true, order: 4, align: 'right' },
      { key: 'paid', label: 'Received', visible: true, order: 5, align: 'right' },
      { key: 'payment', label: 'Payment Mode', visible: true, order: 6 },
      { key: 'status', label: 'Status', visible: true, order: 7, align: 'center' }
    ]
  },
  {
    tableKey: 'records.purchases',
    label: 'Purchase Bill List',
    module: 'purchase',
    columns: [
      { key: 'billNo', label: 'Bill No', visible: true, order: 1 },
      { key: 'date', label: 'Date', visible: true, order: 2 },
      { key: 'party', label: 'Supplier', visible: true, order: 3 },
      { key: 'total', label: 'Total', visible: true, order: 4, align: 'right' },
      { key: 'paid', label: 'Paid', visible: true, order: 5, align: 'right' },
      { key: 'payment', label: 'Payment Mode', visible: true, order: 6 },
      { key: 'status', label: 'Status', visible: true, order: 7, align: 'center' }
    ]
  },
  {
    tableKey: 'records.inventory',
    label: 'Inventory Lots',
    module: 'inventory',
    columns: [
      { key: 'lotId', label: 'Lot ID', visible: true, order: 1 },
      { key: 'item', label: 'Item', visible: true, order: 2 },
      { key: 'remainingPcs', label: 'Pcs', visible: true, order: 3, align: 'right' },
      { key: 'remainingMtrs', label: 'Meters', visible: true, order: 4, align: 'right' },
      { key: 'rate', label: 'Rate', visible: true, order: 5, align: 'right' },
      { key: 'status', label: 'Status', visible: true, order: 6, align: 'center' }
    ]
  }
];

const DEFAULT_FEATURE_FLAGS = [
  { flagKey: 'split_payment', label: 'Split Payment (Cash+Card)', module: 'accounting', enabled: true, scope: 'module' },
  { flagKey: 'sales_broker', label: 'Sales Broker Field', module: 'sales', enabled: true, scope: 'form' },
  { flagKey: 'sales_challan', label: 'Sales Challan Fields', module: 'sales', enabled: true, scope: 'form' },
  { flagKey: 'purchase_broker', label: 'Purchase Broker Field', module: 'purchase', enabled: true, scope: 'form' },
  { flagKey: 'purchase_discount2', label: 'Purchase DIS2 Column', module: 'purchase', enabled: true, scope: 'form' },
  { flagKey: 'ca_desk', label: 'CA Desk (Tax Hub)', module: 'gst', enabled: true, scope: 'module' },
  { flagKey: 'records_hub', label: 'Data Records Hub', module: 'reports', enabled: true, scope: 'global' },
  { flagKey: 'gst_compliance', label: 'GST Compliance Modals', module: 'gst', enabled: true, scope: 'module' },
  { flagKey: 'job_work_mill', label: 'Mill Issue/Receive', module: 'jobWork', enabled: true, scope: 'module' }
];

const DEFAULT_NOTIFICATION_RULES = [
  { ruleKey: 'overdue_invoice', name: 'Overdue Invoice Alert', event: 'overdue_invoice', enabled: true, channels: { inApp: true, email: false } },
  { ruleKey: 'low_stock', name: 'Low Stock Alert', event: 'low_stock', enabled: false, channels: { inApp: true } },
  { ruleKey: 'payment_received', name: 'Payment Received', event: 'payment_received', enabled: true, channels: { inApp: true } },
  { ruleKey: 'subscription_expiry', name: 'Subscription Expiry', event: 'subscription_expiry', enabled: true, channels: { inApp: true, email: true } }
];

const DEFAULT_REPORT_CONFIGS = [
  { reportKey: 'sales_outstanding', name: 'Sales Outstanding', module: 'reports', enabled: true, exportFormats: ['pdf', 'excel'] },
  { reportKey: 'inventory_stock', name: 'Inventory Stock', module: 'inventory', enabled: true, exportFormats: ['pdf', 'excel', 'csv'] },
  { reportKey: 'gstr1', name: 'GSTR-1', module: 'gst', enabled: true, exportFormats: ['json', 'excel'] },
  { reportKey: 'trial_balance', name: 'Trial Balance', module: 'accounting', enabled: false, exportFormats: ['pdf'] }
];

const DEFAULT_PERMISSION_MATRIX = {
  roles: {
    owner: [
      { module: 'sales', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'purchase', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'accounting', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'inventory', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'jobWork', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'masters', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'reports', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'gst', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true }
    ],
    admin: [
      { module: 'sales', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'purchase', canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true, canPrint: true },
      { module: 'accounting', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'inventory', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'jobWork', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'masters', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'reports', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'gst', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true }
    ],
    accountant: [
      { module: 'sales', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'purchase', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'accounting', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'inventory', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: false },
      { module: 'reports', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'masters', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false, canPrint: false }
    ],
    sales: [
      { module: 'sales', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'purchase', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true, canPrint: true },
      { module: 'inventory', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false, canPrint: false },
      { module: 'jobWork', canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: false, canPrint: true }
    ],
    viewer: [
      { module: 'sales', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'purchase', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'reports', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: true },
      { module: 'inventory', canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true, canPrint: false }
    ]
  },
  sections: {
    owner: ['Master', 'Transaction', 'Records', 'Reports', 'Ledger', 'Utilities', 'Admin', 'Company'],
    admin: ['Master', 'Transaction', 'Records', 'Reports', 'Ledger', 'Utilities', 'Admin'],
    accountant: ['Master', 'Records', 'Reports', 'Ledger', 'CA Desk'],
    sales: ['Transaction', 'Records'],
    viewer: ['Records', 'Reports', 'Ledger']
  }
};

const DEFAULT_FORM_CONFIGS = [
  {
    formKey: 'account.master',
    label: 'Account Master',
    module: 'masters',
    fields: [
      { key: 'name', label: 'Entity Name', type: 'text', required: true, visible: true, order: 1 },
      { key: 'group', label: 'Account Group', type: 'select', required: true, visible: true, order: 2 },
      { key: 'station', label: 'City / Station', type: 'text', visible: true, order: 3 },
      { key: 'gstin', label: 'GSTIN', type: 'text', visible: true, order: 4 },
      { key: 'mobile', label: 'Mobile', type: 'text', visible: true, order: 5 },
      { key: 'creditLimit', label: 'Credit Limit', type: 'number', visible: true, order: 6 },
      { key: 'address', label: 'Billing Address', type: 'textarea', visible: true, order: 7 }
    ]
  },
  {
    formKey: 'item.master',
    label: 'Item Master',
    module: 'masters',
    fields: [
      { key: 'itemName', label: 'Item Name', type: 'text', required: true, visible: true, order: 1 },
      { key: 'group', label: 'Category', type: 'select', required: true, visible: true, order: 2 },
      { key: 'unit', label: 'Unit', type: 'select', visible: true, order: 3 },
      { key: 'hsnCode', label: 'HSN Code', type: 'text', visible: true, order: 4 },
      { key: 'taxRate', label: 'GST %', type: 'number', visible: true, order: 5 },
      { key: 'salesRate', label: 'Sales Rate', type: 'number', visible: true, order: 6 },
      { key: 'purRate', label: 'Purchase Rate', type: 'number', visible: true, order: 7 }
    ]
  },
  {
    formKey: 'accounting.receipt',
    label: 'Bank Receipt',
    module: 'accounting',
    fields: [
      { key: 'partyId', label: 'Counterparty', type: 'select', required: true, visible: true, order: 1 },
      { key: 'bankLedgerId', label: 'Settlement Ledger', type: 'select', required: true, visible: true, order: 2 },
      { key: 'date', label: 'Date', type: 'date', required: true, visible: true, order: 3 },
      { key: 'amount', label: 'Amount', type: 'number', required: true, visible: true, order: 4 },
      { key: 'paymentMode', label: 'Payment Mode', type: 'select', visible: true, order: 5 },
      { key: 'splitPayment', label: 'Split Payment', type: 'checkbox', visible: true, order: 6 },
      { key: 'narration', label: 'Narration', type: 'textarea', visible: true, order: 7 }
    ]
  },
  {
    formKey: 'accounting.payment',
    label: 'Bank Payment',
    module: 'accounting',
    fields: [
      { key: 'partyId', label: 'Counterparty', type: 'select', required: true, visible: true, order: 1 },
      { key: 'bankLedgerId', label: 'Settlement Ledger', type: 'select', required: true, visible: true, order: 2 },
      { key: 'date', label: 'Date', type: 'date', required: true, visible: true, order: 3 },
      { key: 'amount', label: 'Amount', type: 'number', required: true, visible: true, order: 4 },
      { key: 'paymentMode', label: 'Payment Mode', type: 'select', visible: true, order: 5 },
      { key: 'chequeNo', label: 'Cheque No', type: 'text', visible: true, order: 6 },
      { key: 'narration', label: 'Narration', type: 'textarea', visible: true, order: 7 }
    ]
  }
];

module.exports = {
  DEFAULT_MODULES,
  DEFAULT_SUB_MENUS,
  DEFAULT_MODULE_FIELDS,
  SALES_BILL_CONFIG,
  PURCHASE_BILL_CONFIG,
  MILL_ISSUE_BILL_CONFIG,
  MILL_RECEIVE_BILL_CONFIG,
  JOB_ISSUE_BILL_CONFIG,
  JOB_RECEIVE_BILL_CONFIG,
  DEFAULT_BILL_CONFIGS,
  DEFAULT_COLUMN_CONFIGS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_NOTIFICATION_RULES,
  DEFAULT_REPORT_CONFIGS,
  DEFAULT_PERMISSION_MATRIX,
  DEFAULT_FORM_CONFIGS
};
