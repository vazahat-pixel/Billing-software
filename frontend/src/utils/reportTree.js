/**
 * JSM-style Reports hierarchy.
 * Leaf nodes with `reportKey` open the report runner.
 */

export const REPORT_TREE = [
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
      { id: 'process-send', label: 'Send', reportKey: 'processSend' },
      { id: 'process-receipt-sum', label: 'Receipt Summary', reportKey: 'processReceiptSummary' },
      { id: 'process-receipt-det', label: 'Receipt Detail', reportKey: 'processReceiptDetail' },
      { id: 'process-stock', label: 'Process Stock', reportKey: 'stock' },
      { id: 'process-item-wise', label: 'Item Wise Summary', reportKey: 'stockItem' },
    ],
  },
  {
    id: 'jobwork',
    label: 'JobWork Reports',
    children: [
      { id: 'jw-send', label: 'Send', reportKey: 'jobwork' },
      { id: 'jw-receipt-sum', label: 'Receipt Summary', reportKey: 'jobwork' },
      { id: 'jw-receipt-det', label: 'Receipt Detail', reportKey: 'jobwork' },
      { id: 'jw-pending', label: 'Jobwork Stock/Pending Report', reportKey: 'jobworkPending' },
      { id: 'jw-challan', label: 'Challan Status', reportKey: 'jobworkChallan' },
      { id: 'jw-pl', label: 'Job P & L', reportKey: 'pl' },
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
      { id: 'inv-lot', label: 'Lot Stock', reportKey: 'stock' },
      { id: 'inv-item', label: 'Item Ledger', reportKey: 'stockItem' },
      { id: 'inv-masters', label: 'Master List', reportKey: 'masters' },
    ],
  },
  {
    id: 'fas',
    label: 'Fas Reports',
    children: [
      { id: 'fas-tb', label: 'Trial Balance', reportKey: 'summary' },
      { id: 'fas-bs', label: 'Balance Sheet', reportKey: 'balanceSheet' },
    ],
  },
  {
    id: 'final',
    label: 'Final Reports',
    children: [
      { id: 'final-pl', label: 'Profit & Loss', reportKey: 'pl' },
      { id: 'final-bs', label: 'Balance Sheet', reportKey: 'balanceSheet' },
    ],
  },
  {
    id: 'tds',
    label: 'Tds Reports',
    children: [{ id: 'tds-reg', label: 'TDS Register', reportKey: 'tds' }],
  },
  {
    id: 'tcs',
    label: 'Tcs Reports',
    children: [{ id: 'tcs-reg', label: 'TCS Register', reportKey: 'tcs' }],
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
  stock: 'inv-lot',
  stockItem: 'inv-item',
  outstanding: 'gst-outstanding',
  jobwork: 'jw-send',
  pl: 'monthly-pl',
  daily: 'monthly-bank',
  masters: 'inv-masters',
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
      openExternal(node.external);
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
    return {
      label: node.label,
      soon: node.soon,
      action: () => openNode(node),
    };
  };

  return [
    { label: 'All Reports Hub', action: () => openHub && openHub('summary') },
    ...REPORT_TREE.map(mapNode),
  ];
}
