/**
 * Build Pu.BillNo lookup rows from open inventory lots + purchase bills.
 */
export function buildPuBillRows({ inventoryLots = [], purchases = [], items = [], weaver = '' } = {}) {
  const weaverKey = String(weaver || '').trim().toLowerCase();
  const rows = [];
  let sral = 0;

  // Build maps for quick lookup of inventory lots
  // Key: purchaseId + lotCode or purchaseId + itemId
  const lotMap = new Map();
  inventoryLots.forEach((lot) => {
    const pid = String(lot.purchaseId?._id || lot.purchaseId || '');
    const itemId = String(lot.itemId?._id || lot.itemId || '');
    const lotCode = String(lot.lotId || '');
    if (pid) {
      if (lotCode) lotMap.set(`${pid}_${lotCode}`, lot);
      lotMap.set(`${pid}_${itemId}`, lot);
    }
  });

  const itemNameOf = (itemObj) => {
    const found = items.find((i) => String(i._id || i.id) === String(itemObj.itemId?._id || itemObj.itemId || ''));
    return found?.itemName || found?.name || itemObj.itemName || 'Item';
  };

  purchases.forEach((p) => {
    const pid = String(p._id || p.id || '');
    const supplierName = p.supplierId?.name || p.supplierName || p.partyName || '';
    
    // Filter by weaver if specified
    if (weaverKey) {
      const match =
        supplierName.toLowerCase().includes(weaverKey) ||
        weaverKey.includes(supplierName.toLowerCase());
      if (!match) return;
    }

    const billNo = p.invoiceNo || p.supplierInvoiceNo || p.billNo || '';
    const lineItems = Array.isArray(p.items) ? p.items : [];

    lineItems.forEach((li, idx) => {
      // Find corresponding inventory lot
      const lotCode = String(li.lotId || '');
      const itemId = String(li.itemId?._id || li.itemId || '');
      const lot = lotMap.get(`${pid}_${lotCode}`) || lotMap.get(`${pid}_${itemId}`);

      const balPcs = lot ? Number(lot.remainingPcs || 0) : Number(li.pcs || 0);
      const balMts = lot ? Number(lot.remainingMtrs || 0) : Number(li.mts || 0);
      const balKgs = lot ? Number(lot.remainingKgs || lot.totalKgs || 0) : Number(li.kgs || 0);

      const puRate = Number(lot?.rate || li.rate || li.purchaseRate || 0);

      rows.push({
        sralNo: ++sral,
        billNo,
        billDt: p.date || p.createdAt || lot?.createdAt || '',
        srNo: idx + 1,
        itemName: lot ? (lot.itemName || lot.itemId?.name || lot.itemId?.itemName || itemNameOf(li)) : itemNameOf(li),
        balPcs,
        balMts,
        balKgs,
        puRate,
        pcs: Number(li.pcs || 0),
        mts: Number(li.mts || 0),
        lrNo: p.lrNo || '',
        transport: p.transport || '',
        lotId: lot?._id || lot?.id || '',
        lotCode: lotCode || lot?.lotId || '',
        purchaseId: pid,
        supplierName,
      });
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
