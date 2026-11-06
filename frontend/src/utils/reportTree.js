import { JSM_REPORTS_TREE } from './jsmMenuTree.js';

/**
 * The Reports menu IS JSM's own menu: folders, order and wording all come from the capture of
 * the real JSM installation (jsm/blueprint/menu.json), built in utils/jsmMenuTree.js. An entry
 * opens a screen when utils/jsmMenuHandlers.js names one; the rest are listed in their own place
 * and marked `soon`, so an operator can see JSM's whole menu and what is not ready yet.
 *
 * This replaced a hand-made tree whose folders and wording had drifted from JSM's. Every screen
 * that tree reached is still reached from this one — utils/jsmMenuTree.node.test.js holds the
 * list and fails if any of them stops being reachable.
 */
export { JSM_OTHERS_TREE } from './jsmMenuTree.js';
export const REPORT_TREE = JSM_REPORTS_TREE;


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
  summary: 'monthly-sales',
  sales: 'monthly-sales',
  purchase: 'purchase-detail',
  stock: 'stock-grey-shop',
  stockItem: 'stock-mts',
  outstanding: 'os-debitors',
  jobwork: 'jw-send',
  pl: 'final-pl',
  daily: 'monthly-bank',
  masters: 'monthly-sales',
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
export function buildReportsMenuItems({ openLeaf, openHub, openExternal, nodes = REPORT_TREE, hub = true }) {
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
    ...(hub ? [{ label: 'All Reports Hub', action: () => openHub && openHub('summary') }] : []),
    ...nodes.map(mapNode),
  ];
}
