const inventoryService = require('../services/inventoryService');
const InventoryLot = require('../models/InventoryLot');

exports.getInventory = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const inventory = await inventoryService.getInventory(companyId);
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLotsByItem = async (req, res) => {
  try {
    const { itemId } = req.query;
    const companyId = req.companyId || req.query.companyId;
    const lots = await InventoryLot.find({ itemId, companyId });
    res.status(200).json({ success: true, data: lots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLotDetails = async (req, res) => {
  try {
    const { lotId } = req.params;
    const companyId = req.companyId || req.query.companyId;
    const details = await inventoryService.getLotDetails(lotId, companyId);
    res.status(200).json({ success: true, data: details });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.getItemStock = async (req, res) => {
  try {
    const { itemId } = req.params;
    const companyId = req.companyId || req.query.companyId;
    const stock = await inventoryService.getStockByItem(itemId, companyId);
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOpeningStock = async (req, res) => {
  try {
    const lot = await inventoryService.createOpeningStock({
      ...req.body,
      companyId: req.companyId
    });
    res.status(201).json({ success: true, data: lot });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
