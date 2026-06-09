const Item = require('../models/Item');

class ItemService {
  async createItem(itemData) {
    const name = (itemData.name || itemData.itemName || '').trim();
    if (!name) {
      throw new Error('Item name is required.');
    }

    let category = 'Grey';
    if (itemData.category) {
      category = itemData.category;
    } else if (itemData.group) {
      const g = itemData.group.toUpperCase();
      if (g.includes('GREY')) category = 'Grey';
      else if (g.includes('FINISHED')) category = 'Finished';
      else if (g.includes('YARN')) category = 'Yarn';
      else category = 'Others';
    }

    const normalized = {
      name,
      category,
      fabricType: itemData.fabricType || itemData.fabricQuality || '',
      design: itemData.design || itemData.designNo || itemData.designName || '',
      color: itemData.color || '',
      size: itemData.size || '',
      hsnCode: itemData.hsnCode || '',
      gstRate: Number(itemData.gstRate || itemData.taxRate || 5),
      unit: itemData.unit || 'MTRS',
      purchaseRate: Number(itemData.purchaseRate || itemData.purRate || 0),
      salesRate: Number(itemData.salesRate || itemData.saleRate || 0),
      openingStock: Number(itemData.openingStock || itemData.opStock || 0),
      companyId: itemData.companyId
    };

    const existing = await Item.findOne({ 
      name: normalized.name, 
      companyId: normalized.companyId 
    });

    if (existing) {
      throw new Error('Item with this name already exists in your company.');
    }

    const item = new Item(normalized);
    return await item.save();
  }

  async getItems(companyId) {
    return await Item.find({ companyId }).sort({ name: 1 });
  }

  async searchItems(query, companyId) {
    const filter = { companyId };
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { hsnCode: { $regex: query, $options: 'i' } },
        { design: { $regex: query, $options: 'i' } }
      ];
    }
    return await Item.find(filter).limit(10).sort({ name: 1 });
  }

  async getItemById(id, companyId) {
    return await Item.findOne({ _id: id, companyId });
  }

  async updateItem(id, companyId, updateData) {
    return await Item.findOneAndUpdate(
      { _id: id, companyId },
      updateData,
      { new: true, runValidators: true }
    );
  }

  async deleteItem(id, companyId) {
    return await Item.findOneAndDelete({ _id: id, companyId });
  }
}

module.exports = new ItemService();
