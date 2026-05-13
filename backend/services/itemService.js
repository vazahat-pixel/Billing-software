const Item = require('../models/Item');

class ItemService {
  async createItem(itemData) {
    const existing = await Item.findOne({ 
      name: itemData.name, 
      companyId: itemData.companyId 
    });

    if (existing) {
      throw new Error('Item with this name already exists in your company.');
    }

    const item = new Item(itemData);
    return await item.save();
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
