/**
 * @deprecated DEAD CODE — Sprint 1.2
 * NOT mounted in routes. Live stack: controllers/purchaseController.js + services/purchaseService.js
 * Do not import this file.
 */
const purchaseService = require('../services/purchase.service');

exports.createPurchase = async (req, res) => {
    try {
        const purchase = await purchaseService.createPurchase(req.companyId, req.body);
        res.status(201).json(purchase);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getPurchases = async (req, res) => {
    try {
        const purchases = await purchaseService.getCompanyPurchases(req.companyId);
        res.status(200).json(purchases);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
