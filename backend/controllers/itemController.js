const itemService = require('../services/itemService');

exports.createItem = async (req, res) => {
  try {
    const item = await itemService.createItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.searchItems = async (req, res) => {
  try {
    const { q, companyId } = req.query;
    const items = await itemService.searchItems(q, companyId);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;
    const item = await itemService.getItemById(id, companyId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.body;
    const item = await itemService.updateItem(id, companyId, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;
    await itemService.deleteItem(id, companyId);
    res.status(200).json({ success: true, message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
