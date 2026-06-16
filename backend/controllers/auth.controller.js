const authService = require('../services/auth.service');

exports.register = async (req, res) => {
    try {
        const { name, email, password, companyName } = req.body;
        if (!name || !email || !password || !companyName) {
            return res.status(400).json({ message: 'Name, email, password and company name are required' });
        }
        const result = await authService.register(name, email, password, companyName);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
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
        if (!email) return res.status(400).json({ message: 'Email is required' });
        const result = await authService.forgotPassword(email);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });
        const result = await authService.resetPassword(token, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

