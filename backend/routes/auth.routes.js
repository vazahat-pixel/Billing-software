const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh', authController.refresh);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

// Prevent unmatched /auth/* from falling through to global authMiddleware
router.use((req, res) => {
  res.status(405).json({ success: false, message: `Cannot ${req.method} ${req.path}` });
});

module.exports = router;

