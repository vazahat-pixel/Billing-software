const Item = require('../models/Item');

function mapCategory(itemData) {
  if (itemData.category && ['Grey', 'Finished', 'Yarn', 'Others'].includes(itemData.category)) {
    return itemData.category;
  }
  const raw = String(itemData.categoryLabel || itemData.group || itemData.category || '').toUpperCase();
  if (raw.includes('GREY')) return 'Grey';
  if (raw.includes('FINISH')) return 'Finished';
  if (raw.includes('YARN')) return 'Yarn';
  if (raw) return 'Others';
  return 'Grey';
}

function mapGst(itemData) {
  const label = String(itemData.gstTaxLabel || itemData.taxLabel || '').toUpperCase();
  if (label.includes('FREE') || label.includes('NIL') || label.includes('EXEMPT')) {
    return { gstRate: 0, gstTaxLabel: itemData.gstTaxLabel || 'GST FREE' };
  }
  if (label.includes('JOBWORK')) {
    return {
      gstRate: Number(itemData.gstRate ?? itemData.taxRate ?? 5),
      gstTaxLabel: itemData.gstTaxLabel || 'GST JOBWORK',
    };
  }
  if (label.includes('MILL')) {
    return {
      gstRate: Number(itemData.gstRate ?? itemData.taxRate ?? 5),
      gstTaxLabel: itemData.gstTaxLabel || 'GST MILL',
    };
  }
  const rate = Number(itemData.gstRate ?? itemData.taxRate ?? 5);
  return {
    gstRate: Number.isFinite(rate) ? rate : 5,
    gstTaxLabel: itemData.gstTaxLabel || (rate === 0 ? 'GST FREE' : `GST ${rate}%`),
  };
}

function normalizePayload(itemData, { requireName = true } = {}) {
  const name = (itemData.name || itemData.itemName || '').trim();
  if (requireName && !name) {
    throw new Error('Item name is required.');
  }
  const gst = mapGst(itemData);
  const openingQty = Number(
    itemData.openingQty ?? itemData.opQty ?? itemData.openingStock ?? itemData.opStock ?? 0
  );
  const openingRate = Number(itemData.openingRate ?? itemData.opRate ?? 0);
  const openingValue =
    itemData.openingValue != null || itemData.opValue != null
      ? Number(itemData.openingValue ?? itemData.opValue ?? 0)
      : Number((openingQty * openingRate).toFixed(2));

  return {
    name: name || undefined,
    itemCode: String(itemData.itemCode || itemData.code || '').trim(),
    category: mapCategory(itemData),
    categoryLabel: String(itemData.categoryLabel || itemData.group || itemData.category || ''),
    fabricType: itemData.fabricType || itemData.fabricQuality || '',
    design: itemData.design || itemData.designNo || itemData.designName || '',
    color: itemData.color || '',
    size: itemData.size || '',
    brand: itemData.brand || '',
    pattern: itemData.pattern || '',
    quality: itemData.quality || '',
    shade: itemData.shade || '',
    hsnCode: itemData.hsnCode || '',
    hsnDigits: Number(itemData.hsnDigits || 0),
    gstRate: gst.gstRate,
    gstTaxLabel: gst.gstTaxLabel,
    unit: itemData.unit || 'MTRS',
    purchaseRate: Number(itemData.purchaseRate || itemData.purRate || 0),
    salesRate: Number(itemData.salesRate || itemData.saleRate || itemData.slRate || 0),
    mrp: Number(itemData.mrp || 0),
    openingStock: openingQty,
    openingPcs: Number(itemData.openingPcs ?? itemData.opPcs ?? 0),
    openingQty,
    openingRate,
    openingValue,
    cut: Number(itemData.cut || 0),
    description: itemData.description || '',
    ewayBillProductName: itemData.ewayBillProductName || itemData.ewayProductName || '',
    imageUrl: itemData.imageUrl || '',
    reorderLevel: Number(itemData.reorderLevel || 0),
    minLevel: Number(itemData.minLevel || 0),
    maxLevel: Number(itemData.maxLevel || 0),
    itemGroupId: itemData.itemGroupId || null,
    defaultWarehouseId: itemData.defaultWarehouseId || null,
    barcode: itemData.barcode || '',
    isFavorite: !!itemData.isFavorite,
    companyId: itemData.companyId,
  };
}

class ItemService {
  async createItem(itemData) {
    const normalized = normalizePayload(itemData, { requireName: true });

    const existing = await Item.findOne({
      name: normalized.name,
      companyId: normalized.companyId,
    });
    if (existing) {
      throw new Error('Item with this name already exists in your company.');
    }

    if (normalized.itemCode) {
      const codeClash = await Item.findOne({
        companyId: normalized.companyId,
        itemCode: normalized.itemCode,
      });
      if (codeClash) {
        throw new Error('Item code already exists in your company.');
      }
    }

    return await new Item(normalized).save();
  }

  async getItems(companyId, { favorites } = {}) {
    const filter = { companyId };
    if (favorites) filter.isFavorite = true;
    return await Item.find(filter).sort({ name: 1 });
  }

  async searchItems(query, companyId) {
    const filter = { companyId };
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { hsnCode: { $regex: query, $options: 'i' } },
        { design: { $regex: query, $options: 'i' } },
        { barcode: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { quality: { $regex: query, $options: 'i' } },
        { itemCode: { $regex: query, $options: 'i' } },
      ];
    }
    return await Item.find(filter).limit(10).sort({ lastUsedAt: -1, name: 1 });
  }

  async getItemById(id, companyId) {
    return await Item.findOne({ _id: id, companyId });
  }

  async updateItem(id, companyId, updateData) {
    const existing = await Item.findOne({ _id: id, companyId });
    if (!existing) return null;

    const merged = {
      ...existing.toObject(),
      ...updateData,
      name: updateData.name || updateData.itemName || existing.name,
      itemName: updateData.itemName || updateData.name || existing.name,
      companyId,
    };
    const mapped = normalizePayload(merged, { requireName: true });
    delete mapped.companyId;

    return await Item.findOneAndUpdate(
      { _id: id, companyId },
      mapped,
      { new: true, runValidators: true }
    );
  }

  async deleteItem(id, companyId) {
    return await Item.findOneAndUpdate(
      { _id: id, companyId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
  }
}

module.exports = new ItemService();
