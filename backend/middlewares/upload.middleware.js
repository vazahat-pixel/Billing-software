const path = require('path');
const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.csv', '.xlsx']);

/**
 * Stage 7.1 — Shared secure upload middleware.
 */
function createUpload({ maxMb = 12, field = 'file' } = {}) {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
        return cb(AppError.badRequest(`File type not allowed: ${file.mimetype || ext}`));
      }
      return cb(null, true);
    },
  });
  return upload.single(field);
}

module.exports = { createUpload, ALLOWED_MIME, ALLOWED_EXT };
