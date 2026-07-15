const SubMaster = require('../models/SubMaster');
const SUB_MASTER_TYPES = SubMaster.SUB_MASTER_TYPES || [];

exports.createSubMaster = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { type, name, extraFields } = req.body;

    if (!type || !name) {
      return res.status(400).json({ success: false, message: 'Type and Name are required' });
    }

    if (!SUB_MASTER_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sub-master type "${type}". Allowed: ${SUB_MASTER_TYPES.join(', ')}`
      });
    }

    const subMaster = await SubMaster.create({
      companyId,
      type,
      name,
      extraFields: extraFields || {}
    });

    res.status(201).json({ success: true, data: subMaster });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A record with this name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubMasters = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { type } = req.query;

    const filter = { companyId };
    if (type) {
      filter.type = type;
    }

    const list = await SubMaster.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSubMaster = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { name, extraFields } = req.body;

    const subMaster = await SubMaster.findOneAndUpdate(
      { _id: id, companyId },
      { name, extraFields },
      { new: true, runValidators: true }
    );

    if (!subMaster) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.status(200).json({ success: true, data: subMaster });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSubMaster = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    const subMaster = await SubMaster.findOneAndUpdate(
      { _id: id, companyId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!subMaster) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.status(200).json({ success: true, message: 'Record deleted successfully', data: subMaster });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
