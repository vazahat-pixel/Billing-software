/**
 * SaaS outbound email — SMTP when configured, otherwise structured console log.
 * No payment gateway dependency. Safe for invite / reset / dunning.
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

function frontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isSmtpConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || 'noreply@billing-software.local';
  const payload = { from, to, subject, text, html: html || text };

  const tx = getTransporter();
  if (!tx) {
    logger.info('email.console', { to, subject, text: String(text || '').slice(0, 500) });
    return { ok: true, mode: 'console' };
  }

  try {
    const info = await tx.sendMail(payload);
    logger.info('email.sent', { to, subject, messageId: info.messageId });
    return { ok: true, mode: 'smtp', messageId: info.messageId };
  } catch (err) {
    logger.error('email.failed', { to, subject, error: err.message });
    // Fall back so ops still see the content in logs
    logger.info('email.console.fallback', { to, subject, text: String(text || '').slice(0, 500) });
    return { ok: false, mode: 'console_fallback', error: err.message };
  }
}

async function sendWelcomeOwner({ to, name, companyName, tempPassword, loginUrl }) {
  const url = loginUrl || `${frontendUrl()}/login`;
  const subject = `Welcome to ${companyName} — your ERP login`;
  const text = [
    `Hi ${name || 'there'},`,
    '',
    `Your company "${companyName}" is ready on Textile ERP.`,
    `Login: ${url}`,
    `Email: ${to}`,
    tempPassword ? `Temporary password: ${tempPassword}` : 'Use the password your administrator shared, or reset via Forgot Password.',
    '',
    'Please change your password after first login.',
  ].join('\n');
  return sendMail({ to, subject, text });
}

async function sendPasswordReset({ to, name, resetToken }) {
  const url = `${frontendUrl()}/forgot-password?token=${encodeURIComponent(resetToken)}`;
  // Prefer dedicated reset page if present
  const resetUrl = `${frontendUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const subject = 'Password reset — Textile ERP';
  const text = [
    `Hi ${name || 'there'},`,
    '',
    'A password reset was requested for your account.',
    `Open this link within 1 hour: ${resetUrl}`,
    '',
    `If the app only has forgot-password, use token: ${resetToken}`,
    `(Fallback link: ${url})`,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');
  return sendMail({ to, subject, text });
}

async function sendSubscriptionReminder({ to, name, companyName, daysLeft, status, renewHint }) {
  const subject = daysLeft <= 0
    ? `Action required: ${companyName} subscription ${status}`
    : `${companyName}: subscription expires in ${daysLeft} day(s)`;
  const text = [
    `Hi ${name || 'Admin'},`,
    '',
    `Company: ${companyName}`,
    `Status: ${status}`,
    `Days left: ${daysLeft}`,
    renewHint || 'Contact your platform administrator to renew the licence/subscription.',
    '',
    `Admin portal: ${frontendUrl()}/admin/login`,
  ].join('\n');
  return sendMail({ to, subject, text });
}

async function sendInviteUser({ to, name, companyName, role, tempPassword }) {
  const subject = `You are invited to ${companyName}`;
  const text = [
    `Hi ${name || 'there'},`,
    '',
    `You have been added to "${companyName}" as ${role || 'user'}.`,
    `Login: ${frontendUrl()}/login`,
    `Email: ${to}`,
    tempPassword ? `Temporary password: ${tempPassword}` : '',
    '',
    'Change your password after first login.',
  ].join('\n');
  return sendMail({ to, subject, text });
}

module.exports = {
  sendMail,
  sendWelcomeOwner,
  sendPasswordReset,
  sendSubscriptionReminder,
  sendInviteUser,
  isSmtpConfigured,
  frontendUrl,
};
