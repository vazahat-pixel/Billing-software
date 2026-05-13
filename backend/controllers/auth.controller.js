const authService = require('../services/auth.service');

exports.register = async (req, res) => {
    try {
        const { name, email, password, companyName } = req.body;
        const result = await authService.register(name, email, password, companyName);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
};

exports.getMe = async (req, res) => {
    res.status(200).json({ user: req.user });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        // In a real app, you would send an email here
        res.status(200).json({ message: 'If an account exists, instructions have been sent.' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};
