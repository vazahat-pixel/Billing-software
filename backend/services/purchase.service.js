const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');

exports.createPurchase = async (companyId, purchaseData) => {
    // 1. Save Purchase
    const purchase = new Purchase({
        ...purchaseData,
        companyId
    });
    await purchase.save();

    // 2. Create Inventory Lots for each item
    const inventoryItems = purchaseData.items.map(item => ({
        companyId,
        itemName: item.itemName,
        lotNo: `LOT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        currentStock: item.quantity,
        purchaseId: purchase._id
    }));

    await Inventory.insertMany(inventoryItems);

    return purchase;
};

exports.getCompanyPurchases = async (companyId) => {
    return await Purchase.find({ companyId }).sort({ createdAt: -1 });
};
