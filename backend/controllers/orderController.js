const Order = require('../models/Order');

async function generateOrderNo(companyId, type) {
  const prefix = type === 'Sales' ? 'SO' : 'PO';
  const count = await Order.countDocuments({ companyId, orderType: type });
  const padded = (count + 1).toString().padStart(4, '0');
  const currentYear = new Date().getFullYear().toString().substring(2);
  return `${prefix}-${currentYear}-${padded}`;
}

exports.createOrder = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { orderType, orderNo, partyId, date, items, totalAmount } = req.body;

    if (!orderType || !partyId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Type, party, and items are required' });
    }

    const calculatedTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const finalOrderNo = orderNo || await generateOrderNo(companyId, orderType);

    const order = await Order.create({
      companyId,
      orderType,
      orderNo: finalOrderNo,
      partyId,
      date: date || new Date(),
      items,
      totalAmount: totalAmount || calculatedTotal,
      status: 'Open'
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An order with this number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { orderType } = req.query;

    const filter = { companyId };
    if (orderType) {
      filter.orderType = orderType;
    }

    const list = await Order.find(filter).populate('partyId').populate('items.itemId').sort({ date: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { status } = req.body;

    if (!['Open', 'Closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: id, companyId },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
