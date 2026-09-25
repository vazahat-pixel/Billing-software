/**
 * POST /api/desktop/offline-login — verify salted local session when central is unreachable.
 * Only meaningful when DESKTOP_HYBRID/DESKTOP_LOCAL.
 */
const express = require('express');
const router = express.Router();
// desktop.routes already exists — append via patch instead
module.exports = {};
