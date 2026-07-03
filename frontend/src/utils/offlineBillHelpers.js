/** Helpers for offline bill save: party/item names, inventory deltas */

const partyId = (p) => p?._id || p?.id;

export const findParty = (parties, id) => {
  if (!id) return null;
  const sid = String(id);
  return parties.find((p) => String(partyId(p)) === sid) || null;
};

export const findItem = (items, id) => {
  if (!id) return null;
  const sid = String(id);
  return items.find((i) => String(i._id || i.id) === sid) || null;
};

export const enrichSalePayload = (saleData, { parties, items, user }) => {
  const rawCustomerId =
    typeof saleData.customerId === 'object'
      ? partyId(saleData.customerId)
      : saleData.customerId;
  const party = findParty(parties, rawCustomerId);
  const broker = saleData.brokerId ? findParty(parties, saleData.brokerId) : null;

  const enrichedItems = (saleData.items || []).map((line) => {
    const rawItemId = typeof line.itemId === 'object' ? partyId(line.itemId) : line.itemId;
    const item = findItem(items, rawItemId);
    return {
      ...line,
      itemId: rawItemId,
      itemName: line.itemName || item?.name || item?.itemName || '',
      itemCode: line.itemCode || item?.code || '',
      hsn: line.hsn || item?.hsn || ''
    };
  });

  return {
    ...saleData,
    companyId: saleData.companyId || user?.companyId,
    customerId: party
      ? {
          _id: party._id || party.id,
          id: party._id || party.id,
          name: party.name,
          gstin: party.gstin,
          city: party.city
        }
      : rawCustomerId,
    customerName: party?.name || saleData.customerName || '',
    brokerId: broker
      ? { _id: broker._id, id: broker.id, name: broker.name }
      : saleData.brokerId || null,
    items: enrichedItems
  };
};

export const enrichPurchasePayload = (purchaseData, { parties, items, user }) => {
  const rawSupplierId =
    typeof purchaseData.supplierId === 'object'
      ? partyId(purchaseData.supplierId)
      : purchaseData.supplierId;
  const party = findParty(parties, rawSupplierId);

  const enrichedItems = (purchaseData.items || []).map((line) => {
    const rawItemId = typeof line.itemId === 'object' ? partyId(line.itemId) : line.itemId;
    const item = findItem(items, rawItemId);
    return {
      ...line,
      itemId: rawItemId,
      itemName: line.itemName || item?.name || item?.itemName || '',
      itemCode: line.itemCode || item?.code || '',
      hsn: line.hsn || item?.hsn || ''
    };
  });

  return {
    ...purchaseData,
    companyId: purchaseData.companyId || user?.companyId,
    supplierId: party
      ? {
          _id: party._id || party.id,
          id: party._id || party.id,
          name: party.name,
          gstin: party.gstin,
          city: party.city
        }
      : rawSupplierId,
    supplierName: party?.name || purchaseData.supplierName || '',
    items: enrichedItems
  };
};

export const linkSalesWithParties = (sales, parties) =>
  (sales || []).map((sale) => {
    if (sale.customerName || sale.customerId?.name) return sale;
    const rawId =
      typeof sale.customerId === 'object' ? partyId(sale.customerId) : sale.customerId;
    const party = findParty(parties, rawId);
    if (!party) return sale;
    return {
      ...sale,
      customerName: party.name,
      customerId: {
        _id: party._id || party.id,
        id: party._id || party.id,
        name: party.name,
        gstin: party.gstin,
        city: party.city
      }
    };
  });

export const linkPurchasesWithParties = (purchases, parties) =>
  (purchases || []).map((purchase) => {
    if (purchase.supplierName || purchase.supplierId?.name) return purchase;
    const rawId =
      typeof purchase.supplierId === 'object'
        ? partyId(purchase.supplierId)
        : purchase.supplierId;
    const party = findParty(parties, rawId);
    if (!party) return purchase;
    return {
      ...purchase,
      supplierName: party.name,
      supplierId: {
        _id: party._id || party.id,
        id: party._id || party.id,
        name: party.name,
        gstin: party.gstin,
        city: party.city
      }
    };
  });

const lineQty = (line) => Number(line.mts || line.pcs || line.qty || 0);

export const applySaleToInventory = (lots, saleItems) => {
  const updated = (lots || []).map((l) => ({ ...l }));
  for (const line of saleItems || []) {
    const deduct = lineQty(line);
    if (!deduct) continue;
    if (line.lotId) {
      const lot = updated.find((l) => String(l._id || l.id) === String(line.lotId));
      if (lot) {
        const bal = Number(lot.balanceQty ?? lot.qty ?? 0);
        lot.balanceQty = Math.max(0, bal - deduct);
        lot.qty = lot.balanceQty;
      }
    }
  }
  return updated;
};

export const applyPurchaseToInventory = (lots, purchaseItems, items) => {
  const updated = (lots || []).map((l) => ({ ...l }));
  for (const line of purchaseItems || []) {
    const addQty = lineQty(line);
    if (!addQty) continue;
    const rawItemId = typeof line.itemId === 'object' ? partyId(line.itemId) : line.itemId;
    if (line.lotId) {
      const lot = updated.find((l) => String(l._id || l.id) === String(line.lotId));
      if (lot) {
        const bal = Number(lot.balanceQty ?? lot.qty ?? 0);
        lot.balanceQty = bal + addQty;
        lot.qty = lot.balanceQty;
      }
    } else if (rawItemId) {
      const item = findItem(items, rawItemId);
      updated.push({
        _id: `local-lot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id: `local-lot-${Date.now()}`,
        itemId: rawItemId,
        itemName: item?.name || line.itemName || '',
        balanceQty: addQty,
        qty: addQty,
        offlinePending: true
      });
    }
  }
  return updated;
};

export const isLocalBillId = (id) => String(id || '').startsWith('local-');
