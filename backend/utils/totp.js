/**
 * Minimal TOTP (RFC 6238) for super_admin 2FA — no extra npm deps beyond Node crypto.
 */
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  const cleaned = String(str || '').replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1e6).padStart(6, '0');
}

function totp(secret, step = 30, skew = 1) {
  const counter = Math.floor(Date.now() / 1000 / step);
  const codes = new Set();
  for (let i = -skew; i <= skew; i += 1) {
    codes.add(hotp(secret, counter + i));
  }
  return codes;
}

function verifyTotp(secret, token, skew = 1) {
  if (!secret || !token) return false;
  const normalized = String(token).replace(/\s/g, '');
  return totp(secret, 30, skew).has(normalized);
}

function otpauthUrl({ secret, email, issuer = 'TextileERP-Admin' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  generateSecret,
  verifyTotp,
  otpauthUrl,
};
