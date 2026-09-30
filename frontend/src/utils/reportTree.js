/**
 * JSM-style Reports hierarchy.
 * Leaf nodes with `reportKey` open the report runner.
 */

export const REPORT_TREE = [
  {
    id: 'fas',
    label: 'Fas Reports',
    children: [
      { id: 'fas-cashbook', label: 'Bank / Cash Book', external: 'cashBook' },
      { id: 'fas-ledger', label: 'Ledger', external: 'ledger' },
      { id: 'fas-ledger-t', label: 'Ledger T-Format', external: 'ledger' },
      { id: 'fas-interest', label: 'Ledger Interest', external: 'fasCheck', reportKind: 'interest' },
      { id: 'fas-confirm', label: 'Confirmation', external: 'fasCheck', reportKind: 'confirmation' },
      { id: 'fas-above', label: 'Above Below Rs.', external: 'fasCheck', reportKind: 'aboveBelow' },
      { id: 'fas-voucher', label: 'Voucher Book', external: 'journal' },
      { id: 'fas-ledger-old', label: 'Ledger(Old)', external: 'ledger' },
      { id: 'fas-old-ledger', label: 'Old Ledger', external: 'ledger' },
      { id: 'fas-import-bank', label: 'Import Bank', external: 'fasCheck', reportKind: 'importBank' },
    ],
  },
  {
    id: 'final',
    label: 'Final Reports',
    children: [
      { id: 'final-group', label: 'Group List', external: 'finalReport', reportKind: 'groupList' },
      { id: 'final-tb', label: 'Trail Balance', external: 'finalReport', reportKind: 'trial' },
      { id: 'final-pl', label: 'Profit & Loss Account', external: 'finalReport', reportKind: 'pl' },
      { id: 'final-bs', label: 'BalanceSheet', external: 'finalReport', reportKind: 'bs' },
      { id: 'final-diff-os', label: 'Chek Diff Os.Bill/Op.Balance', external: 'fasCheck', reportKind: 'diffOpening' },
      { id: 'final-cash-fin', label: 'CashBank Finance', external: 'cashBook' },
      { id: 'final-diff-year', label: 'Check Diff Os/Ledger Cur.Year', external: 'fasCheck', reportKind: 'diffYear' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    children: [
      {
        id: 'sales-bill',
        label: 'Sales Bill',
        children: [
          { id: 'sales-summary', label: 'Sales Summary', reportKey: 'salesSummary' },
          { id: 'sales-detail', label: 'Sales ItemDetail', reportKey: 'salesDetail' },
          { id: 'sales-item-wise', label: 'Item Wise Summary', reportKey: 'salesItemWise' },
          { id: 'sales-haste', label: 'Haste/Transport', reportKey: 'salesHaste' },
          { id: 'sales-order-reg', label: 'Sales Order Register', reportKey: 'salesOrder' },
          { id: 'sales-challan', label: 'Sales Challan', reportKey: 'salesChallan' },
          { id: 'sales-outstanding', label: 'Sales Outstanding', external: 'outstandingSalesFull' },
        ],
      },
      {
        id: 'sales-return',
        label: 'Sales Return',
        children: [
          { id: 'sales-return-reg', label: 'Sales Return Register', reportKey: 'salesReturn' },
        ],
      },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    children: [
      {
        id: 'purchase-bill',
        label: 'Purchase Bill',
        children: [
          { id: 'purchase-summary', label: 'Purchase Summary', reportKey: 'purchaseSummary' },
          { id: 'purchase-detail', label: 'Purchase ItemDetail', reportKey: 'purchaseDetail' },
          { id: 'purchase-item-wise', label: 'Item Wise Summary', reportKey: 'purchaseItemWise' },
          { id: 'purchase-order', label: 'Purchase Order', reportKey: 'purchaseOrder' },
          { id: 'purchase-outstanding', label: 'Purchase Outstanding', external: 'outstandingPurchaseFull' },
        ],
      },
      {
        id: 'purchase-return',
        label: 'Purchase Return',
        children: [
          { id: 'purchase-return-reg', label: 'Purchase Return Register', reportKey: 'purchaseReturn' },
        ],
      },
      {
        id: 'purchase-stock',
        label: 'Purchase Stock',
        children: [
          { id: 'purchase-stock-lot', label: 'Lot Stock', reportKey: 'stock' },
          { id: 'purchase-stock-item', label: 'Item Wise Stock', reportKey: 'stockItem' },
        ],
      },
    ],
  },
  {
    id: 'process',
    label: 'Process Reports',
    children: [
      { id: 'process-send', label: 'Send', reportKey: 'processSend', view: 'send' },
      { id: 'process-receipt-sum', label: 'Receipt Summary', reportKey: 'processReceiptSummary', view: 'receiptSummary' },
      { id: 'process-receipt-det', label: 'Receipt Detail', reportKey: 'processReceiptDetail', view: 'receiptDetail' },
      { id: 'process-stock', label: 'Process Stock', reportKey: 'processSend', view: 'stock' },
      { id: 'process-stock-zoom', label: 'Process Stock Zoom', reportKey: 'processSend', view: 'stockZoom' },
      { id: 'process-item-wise', label: 'Item Wise Summary', reportKey: 'processSend', view: 'itemWise' },
      { id: 'process-taka', label: 'TakaWise Stock Detail', reportKey: 'processSend', view: 'taka' },
      { id: 'process-lot-cost', label: 'Lot Wise Costing', reportKey: 'processSend', view: 'lotCost' },
      { id: 'process-cutting', label: 'Cutting Reports', reportKey: 'processSend', view: 'cutting' },
      { id: 'process-lot-status', label: 'Update Lot Status', reportKey: 'processSend', view: 'lotStatus' },
      { id: 'process-interest', label: 'Process Bill Wise Interest', reportKey: 'processSend', view: 'billDue' },
    ],
  },
  {
    id: 'jobwork',
    label: 'JobWork Reports',
    children: [
      { id: 'jw-send', label: 'Send', reportKey: 'jobwork', view: 'send' },
      { id: 'jw-receipt-sum', label: 'Receipt Summary', reportKey: 'jobwork', view: 'receiptSummary' },
      { id: 'jw-receipt-det', label: 'Receipt Detail', reportKey: 'jobwork', view: 'receiptDetail' },
      { id: 'jw-pending', label: 'Jobwork Stock/Pending Report', reportKey: 'jobworkPending', view: 'stock' },
      { id: 'jw-challan', label: 'Challan Status', reportKey: 'jobworkChallan', view: 'challan' },
      { id: 'jw-pl', label: 'Job P & L', reportKey: 'jobwork', view: 'jobPl' },
    ],
  },
  {
    id: 'monthly',
    label: 'Monthly Reports',
    children: [
      { id: 'monthly-sales', label: 'Sales', reportKey: 'salesDetail' },
      { id: 'monthly-purchase', label: 'Purchase', reportKey: 'purchaseDetail' },
      { id: 'monthly-process', label: 'Process', reportKey: 'processSend' },
      { id: 'monthly-jobwork', label: 'JobWork', reportKey: 'jobwork' },
      { id: 'monthly-sales-return', label: 'Sales Return', reportKey: 'salesReturn' },
      { id: 'monthly-purchase-return', label: 'Purchase Return', reportKey: 'purchaseReturn' },
      { id: 'monthly-bank', label: 'Bank Rec. Payment', reportKey: 'daily' },
      { id: 'monthly-summary', label: 'Period Summary', reportKey: 'summary' },
      { id: 'monthly-pl', label: 'Profit & Loss', reportKey: 'pl' },
    ],
  },
  {
    id: 'gst',
    label: 'Gst Reports',
    children: [
      { id: 'gst-hub', label: 'GST Reports Hub', reportKey: 'gstHub', external: 'gstReports' },
      { id: 'gst-gstr1', label: 'GSTR-1', reportKey: 'gstr1', external: 'gstr1' },
      { id: 'gst-outstanding', label: 'Outstanding', reportKey: 'outstanding' },
    ],
  },
  {
    id: 'stock-ledger',
    label: 'Inv Stock Ledger',
    children: [
      { id: 'stock-mts', label: 'Stock Mts Reports', external: 'stockLedger', reportKind: 'stockMts' },
      { id: 'stock-kgs', label: 'Stock Mts Reports(Kgs)', external: 'stockLedger', reportKind: 'stockKgs' },
      { id: 'stock-finish-shop', label: 'Finish At Shop Stock', external: 'stockLedger', reportKind: 'finishShop' },
      { id: 'stock-grey-shop', label: 'Grey At Shop Stock', external: 'stockLedger', reportKind: 'greyShop' },
      { id: 'stock-grey-pcs', label: 'Grey At Shop Stock (Pcs)', external: 'stockLedger', reportKind: 'greyShopPcs' },
      { id: 'stock-grey-mill', label: 'Grey At Mill Stock - Format 2', external: 'stockLedger', reportKind: 'greyMill' },
      { id: 'stock-finish-excel', label: 'Finish Stock Excel', external: 'stockLedger', reportKind: 'finishExcel' },
      { id: 'stock-finish-book', label: 'Finish At Shop Stock(Book-Acc)', external: 'stockLedger', reportKind: 'finishBook' },
      { id: 'stock-value', label: 'Stock Value Reports', external: 'stockLedger', reportKind: 'stockValue' },
    ],
  },
  {
    id: 'tds',
    label: 'Tds Reports',
    children: [
      { id: 'tds-head', label: 'Head Wise Report', reportKey: 'tds', view: 'tdsHead' },
      { id: 'tds-party', label: 'Party Wise Report', reportKey: 'tds', view: 'tdsParty' },
      { id: 'tds-monthly', label: 'Party Wise Monthly Report', reportKey: 'tds', view: 'tdsMonthly' },
      { id: 'tds-address', label: 'Address/Acknowledge', reportKey: 'tds', view: 'tdsAddress' },
      { id: 'tds-challan', label: 'Tax Challan', reportKey: 'tds', view: 'tdsChallan' },
      { id: 'tds-certificate', label: 'Certificate', reportKey: 'tds', view: 'tdsCertificate' },
      { id: 'tds-reg', label: 'Tds Register', reportKey: 'tds', view: 'tdsRegister' },
    ],
  },
  {
    id: 'tcs',
    label: 'Tcs Reports',
    children: [
      { id: 'tcs-recpay', label: 'Tcs Rec/Pay Report', reportKey: 'tcs', view: 'tcsRecPay' },
      { id: 'tcs-sales', label: 'Tcs Sales Register', reportKey: 'tcs', view: 'tcsSales' },
      { id: 'tcs-purchase', label: 'Tcs Purchase Register', reportKey: 'tcs', view: 'tcsPurchase' },
    ],
  },
];

/** Flat list of leaf nodes for lookup */
export function flattenReportLeaves(nodes = REPORT_TREE, trail = []) {
  const out = [];
  for (const n of nodes) {
    const path = [...trail, n.label];
    if (n.children?.length) {
      out.push(...flattenReportLeaves(n.children, path));
    } else if (n.reportKey || n.external) {
      out.push({ ...n, path });
    }
  }
  return out;
}

export function findReportLeaf(id, nodes = REPORT_TREE) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findReportLeaf(id, n.children);
      if (found) return found;
    }
  }
  return null;
}

/** Map legacy hub tab ids → first matching leaf id */
export const LEGACY_TAB_TO_LEAF = {
  summary: 'monthly-summary',
  sales: 'sales-detail',
  purchase: 'purchase-detail',
  stock: 'stock-grey-shop',
  stockItem: 'stock-mts',
  outstanding: 'gst-outstanding',
  jobwork: 'jw-send',
  pl: 'monthly-pl',
  daily: 'monthly-bank',
  masters: 'monthly-summary',
};

/** Ids of folders that contain this leaf, so the hub can expand to it. */
export function reportAncestorIds(id, nodes = REPORT_TREE, trail = []) {
  for (const n of nodes) {
    if (n.id === id) return trail;
    if (n.children?.length) {
      const found = reportAncestorIds(id, n.children, [...trail, n.id]);
      if (found) return found;
    }
  }
  return null;
}

/** Build Dashboard menu items with nested `children` from REPORT_TREE */
export function buildReportsMenuItems({ openLeaf, openHub, openExternal }) {
  const openNode = (node) => {
    if (node.external && openExternal) {
      openExternal(node);
      return;
    }
    if (openLeaf) openLeaf(node.id);
    else if (openHub) openHub(node.reportKey || 'summary');
  };

  const mapNode = (node) => {
    if (node.children?.length) {
      return {
        label: node.label,
        children: node.children.map(mapNode),
      };
    }
    if (node.soon) return { label: node.label, soon: true };
    return {
      label: node.label,
      action: () => openNode(node),
    };
  };

  return [
    { label: 'All Reports Hub', action: () => openHub && openHub('summary') },
    ...REPORT_TREE.map(mapNode),
  ];
}
