/**
 * Build Pu.BillNo lookup rows from open inventory lots + purchase bills.
 */
export function buildPuBillRows({ inventoryLots = [], purchases = [], items = [], weaver = '' } = {}) {
  const purchaseById = new Map();
  purchases.forEach((p) => {
    const id = String(p._id || p.id || '');
    if (id) purchaseById.set(id, p);
  });

  const itemNameOf = (lot) => {
    const fromLot = lot.itemName || lot.itemId?.name || lot.itemId?.itemName;
    if (fromLot) return fromLot;
    const itemId = String(lot.itemId?._id || lot.itemId || '');
    const found = items.find((i) => String(i._id || i.id) === itemId);
    return found?.itemName || found?.name || 'Item';
  };

  const weaverKey = String(weaver || '').trim().toLowerCase();
  const rows = [];
  let sral = 0;

  (inventoryLots || []).forEach((lot) => {
    const balPcs = Number(lot.remainingPcs || 0);
    const balMts = Number(lot.remainingMtrs || 0);
    if (balPcs <= 0 && balMts <= 0) return;
    if (lot.status === 'Closed') return;
    if (lot.holdStatus && lot.holdStatus !== 'None') return;

    const pid = String(lot.purchaseId?._id || lot.purchaseId || '');
    const purchase = pid ? purchaseById.get(pid) : null;
    const supplierName =
      purchase?.supplierId?.name ||
      purchase?.supplierName ||
      purchase?.partyName ||
      '';

    if (weaverKey) {
      const match =
        supplierName.toLowerCase().includes(weaverKey) ||
        weaverKey.includes(supplierName.toLowerCase()) ||
        String(lot.weaver || '').toLowerCase().includes(weaverKey);
      if (!match && supplierName) return;
    }

    const billNo =
      purchase?.invoiceNo ||
      purchase?.supplierInvoiceNo ||
      lot.purchaseInvoiceNo ||
      lot.invoiceNo ||
      '';

    const lineItems = Array.isArray(purchase?.items) ? purchase.items : [];
    const lotCode = String(lot.lotId || '');
    let lineIdx = lineItems.findIndex((li) => String(li.lotId || '') === lotCode);
    if (lineIdx < 0) lineIdx = 0;
    const line = lineItems[lineIdx] || {};

    const puRate =
      Number(lot.rate) ||
      Number(line.rate) ||
      Number(line.purchaseRate) ||
      0;

    rows.push({
      sralNo: ++sral,
      billNo,
      billDt: purchase?.date || lot.createdAt || '',
      srNo: lineIdx + 1,
      itemName: itemNameOf(lot),
      balPcs,
      balMts,
      balKgs: Number(lot.remainingKgs || lot.totalKgs || line.kgs || 0),
      puRate,
      lrNo: purchase?.lrNo || '',
      transport: purchase?.transport || '',
      lotId: lot._id || lot.id,
      lotCode,
      purchaseId: pid,
      supplierName,
    });
  });

  return rows.sort((a, b) => {
    const da = new Date(a.billDt || 0).getTime();
    const db = new Date(b.billDt || 0).getTime();
    return db - da;
  }).map((r, i) => ({ ...r, sralNo: i + 1 }));
}

export function fmtBillDate(d) {
  if (!d) return '';
  const raw = String(d).includes('T') ? String(d).split('T')[0] : d;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
