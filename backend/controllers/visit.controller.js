const Visit = require('../models/Visit');

exports.createVisit = async (req, res) => {
    try {
        const visitData = {
            ...req.body,
            companyId: req.user.companyId,
            userId: req.user.id
        };
        const visit = new Visit(visitData);
        await visit.save();
        res.status(201).json(visit);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getVisits = async (req, res) => {
    try {
        const visits = await Visit.find({ companyId: req.user.companyId })
            .populate('partyId', 'name')
            .populate('userId', 'name')
            .sort({ visitDate: -1 });
        res.status(200).json(visits);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getVisitById = async (req, res) => {
    try {
        const visit = await Visit.findOne({ _id: req.params.id, companyId: req.user.companyId })
            .populate('partyId', 'name')
            .populate('userId', 'name');
        if (!visit) return res.status(404).json({ message: 'Visit not found' });
        res.status(200).json(visit);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
