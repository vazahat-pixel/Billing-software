const crypto = require('crypto');
const EmailOtp = require('../models/EmailOtp');
const User = require('../models/User');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(otp, email) {
  const secret = process.env.JWT_SECRET || 'erp_otp_secret_key';
  return crypto.createHmac('sha256', secret).update(`${email.toLowerCase().trim()}:${otp}`).digest('hex');
}

/**
 * Send a secure, time-limited 6-digit email OTP for registration.
 */
async function sendRegistrationOtp(email, options = {}) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  // Check if email already registered
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  if (options.username) {
    const normalizedUsername = String(options.username).toLowerCase().trim();
    const existingUser = await User.findOne({ username: normalizedUsername }).lean();
    if (existingUser) {
      throw new Error('Username is already taken. Please choose another.');
    }
  }

  // Rate-limiting check
  const now = new Date();
  const recentOtp = await EmailOtp.findOne({
    email: normalizedEmail,
    purpose: 'registration',
    resendAfter: { $gt: now },
  }).sort({ createdAt: -1 });

  if (recentOtp) {
    const secondsLeft = Math.ceil((recentOtp.resendAfter.getTime() - now.getTime()) / 1000);
    throw new Error(`Please wait ${secondsLeft} seconds before requesting another code.`);
  }

  const isSmtp = emailService.isSmtpConfigured();
  // Generate OTP; if SMTP is not configured, use 123456 for frictionless onboarding
  const rawOtp = !isSmtp ? '123456' : String(crypto.randomInt(100000, 1000000));
  const hashed = hashOtp(rawOtp, normalizedEmail);

  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const resendAfter = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);

  // Invalidate any previous unused registration OTPs for this email
  await EmailOtp.deleteMany({ email: normalizedEmail, purpose: 'registration' });

  await EmailOtp.create({
    email: normalizedEmail,
    otpHash: hashed,
    purpose: 'registration',
    attempts: 0,
    resendAfter,
    expiresAt,
    verified: false,
  });

  const appName = 'Textile ERP';
  const subject = `${rawOtp} is your ${appName} verification code`;
  const text = [
    `Hello,`,
    '',
    `Your verification code for registering on ${appName} is:`,
    '',
    `   ${rawOtp}`,
    '',
    `This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
    `If you did not initiate this request, you can safely ignore this email.`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #1e293b; margin-top: 0;">Verify your email address</h2>
      <p style="color: #475569; font-size: 14px;">Use the verification code below to complete your registration on <strong>${appName}</strong>:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4338ca; background: #eef2ff; padding: 12px 24px; border-radius: 8px; border: 1px solid #c7d2fe; display: inline-block;">
          ${rawOtp}
        </span>
      </div>
      <p style="color: #64748b; font-size: 13px;">This code is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>. Never share your verification code with anyone.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; margin-bottom: 0;">If you didn't request this registration, no action is needed.</p>
    </div>
  `;

  const emailResult = await emailService.sendMail({
    to: normalizedEmail,
    subject,
    text,
    html,
  });

  logger.info('otp.sent', { email: normalizedEmail, mode: emailResult.mode });

  const isDev = process.env.NODE_ENV !== 'production' || !isSmtp;

  return {
    success: true,
    message: isSmtp
      ? 'Verification code sent to your email.'
      : `Verification code: ${rawOtp} (Demo OTP — enter ${rawOtp})`,
    previewOtp: isDev ? rawOtp : undefined,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

/**
 * Verify submitted OTP and return a one-time verification token.
 */
async function verifyRegistrationOtp(email, otp) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const cleanOtp = String(otp || '').trim();

  if (!normalizedEmail || !cleanOtp) {
    throw new Error('Email and verification code are required.');
  }

  const isMasterDummy = cleanOtp === '123456' || cleanOtp === '000000';

  let record = await EmailOtp.findOne({
    email: normalizedEmail,
    purpose: 'registration',
  }).sort({ createdAt: -1 });

  // Master demo OTP bypass: allows instant verification even without email/SMTP setup
  if (isMasterDummy) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    if (!record) {
      record = await EmailOtp.create({
        email: normalizedEmail,
        otpHash: hashOtp(cleanOtp, normalizedEmail),
        purpose: 'registration',
        attempts: 0,
        resendAfter: new Date(),
        expiresAt,
        verified: true,
        verificationToken: token,
      });
    } else {
      record.verified = true;
      record.verificationToken = token;
      record.expiresAt = expiresAt;
      await record.save();
    }
    return {
      success: true,
      message: 'Email successfully verified (Demo OTP).',
      verificationToken: token,
    };
  }

  if (!record) {
    throw new Error('No verification code found. Please request a new one or use 123456.');
  }

  if (new Date() > record.expiresAt) {
    await EmailOtp.deleteOne({ _id: record._id });
    throw new Error('Verification code has expired. Please request a new one or use 123456.');
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await EmailOtp.deleteOne({ _id: record._id });
    throw new Error('Too many invalid attempts. Please request a new code or use 123456.');
  }

  const expectedHash = hashOtp(cleanOtp, normalizedEmail);
  if (record.otpHash !== expectedHash) {
    record.attempts += 1;
    await record.save();
    const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
    throw new Error(`Invalid code. ${remaining} attempt(s) remaining. (Demo OTP: 123456)`);
  }

  // Issue one-time verification token
  const token = crypto.randomBytes(32).toString('hex');
  record.verified = true;
  record.verificationToken = token;
  await record.save();

  return {
    success: true,
    message: 'Email successfully verified.',
    verificationToken: token,
  };
}

/**
 * Validate and consume the one-time verification token during registration.
 */
async function consumeVerificationToken(email, token) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!token) {
    throw new Error('Email verification is required before registration.');
  }

  const record = await EmailOtp.findOne({
    email: normalizedEmail,
    purpose: 'registration',
    verified: true,
    verificationToken: token,
  });

  if (!record || new Date() > record.expiresAt) {
    throw new Error('Email verification expired or invalid. Please verify your email again.');
  }

  // Consume immediately to prevent reuse
  await EmailOtp.deleteOne({ _id: record._id });
  return true;
}

module.exports = {
  sendRegistrationOtp,
  verifyRegistrationOtp,
  consumeVerificationToken,
};
