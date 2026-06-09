const partyService = require('../services/partyService');

exports.createParty = async (req, res) => {
  try {
    req.body.companyId = req.companyId;
    const party = await partyService.createParty(req.body);
    res.status(201).json({ success: true, data: party });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getParties = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const parties = await partyService.getParties(companyId);
    res.status(200).json({ success: true, data: parties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchParties = async (req, res) => {
  try {
    const { q } = req.query;
    const companyId = req.companyId || req.query.companyId;
    const parties = await partyService.searchParties(q, companyId);
    res.status(200).json({ success: true, data: parties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getParty = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.query.companyId;
    const party = await partyService.getPartyById(id, companyId);
    if (!party) return res.status(404).json({ success: false, message: 'Party not found' });
    res.status(200).json({ success: true, data: party });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateParty = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.body.companyId || req.query.companyId;
    req.body.companyId = companyId;
    const party = await partyService.updateParty(id, companyId, req.body);
    res.status(200).json({ success: true, data: party });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteParty = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.query.companyId;
    await partyService.deleteParty(id, companyId);
    res.status(200).json({ success: true, message: 'Party deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
