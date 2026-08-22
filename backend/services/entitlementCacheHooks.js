/**
 * Entitlement cache invalidation.
 *
 * Wired at the model layer rather than in each controller: any write to a
 * commercial model — from admin routes, scripts, migrations or services —
 * drops that company's cached entitlements. A new write path cannot forget
 * to invalidate, because it does not have to know about the cache at all.
 *
 * Implementation note: schema.post() cannot be used here. Mongoose compiles
 * middleware into the model at model() time, and every one of these models is
 * compiled at require() time — long before install() runs during boot. Hooks
 * registered afterwards are silently ignored. So the model's write methods are
 * wrapped directly instead, which is independent of load order.
 *
 * Call install() once at boot.
 */
const entitlementService = require('./entitlementService');
const logger = require('../utils/logger');

/** Models whose writes change what a company is entitled to. */
const WATCHED = [
  { model: 'Company', path: '../models/Company', companyFrom: 'self' },
  { model: 'Subscription', path: '../models/Subscription', companyFrom: 'companyId' },
  { model: 'License', path: '../models/License', companyFrom: 'companyId' },
  { model: 'CompanyModuleConfig', path: '../models/CompanyModuleConfig', companyFrom: 'companyId' },
  // A Plan is shared by many companies — a plan edit clears the whole cache.
  { model: 'Plan', path: '../models/Plan', companyFrom: 'all' },
];

/** Model statics that can change entitlement-relevant state. */
const WRITE_METHODS = [
  'create',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findByIdAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'findByIdAndDelete',
  'findByIdAndRemove',
  'deleteOne',
  'deleteMany',
  'bulkWrite',
];

const drop = (companyId, source) => {
  try {
    // A null id clears the whole cache — correct when the write target is
    // unknown or shared (e.g. a Plan edit affecting many companies).
    entitlementService.invalidate(companyId || undefined);
  } catch (err) {
    logger.warn('Entitlement cache invalidation failed', { source, error: err.message });
  }
};

/**
 * Best-effort companyId from whatever a write method was handed.
 * Returns null to mean "clear everything" rather than guessing wrong.
 */
function extractCompanyId(args, companyFrom) {
  if (companyFrom === 'all') return null;
  const field = companyFrom === 'self' ? '_id' : companyFrom;

  for (const arg of args) {
    if (!arg || typeof arg !== 'object' || Array.isArray(arg)) continue;
    const direct = arg[field];
    if (direct && typeof direct !== 'object') return direct;
    // ObjectId instances are objects but stringify correctly.
    if (direct && direct._bsontype === 'ObjectId') return direct;
    // findByIdAndUpdate(id, ...) — a bare id arrives as a string/ObjectId,
    // handled by the primitive scan below.
    const nested = arg.$set?.[field];
    if (nested) return nested;
  }

  // findById* style: first arg is the id itself.
  if (companyFrom === 'self' && args.length) {
    const first = args[0];
    if (typeof first === 'string' || first?._bsontype === 'ObjectId') return first;
  }

  return null;
}

let installed = false;

function install() {
  if (installed) return;
  installed = true;

  const wrapped = [];

  for (const { model, path: modelPath, companyFrom } of WATCHED) {
    let Model;
    try {
      Model = require(modelPath);
    } catch (err) {
      logger.warn(`Entitlement hooks: could not load model ${model}`, { error: err.message });
      continue;
    }

    for (const method of WRITE_METHODS) {
      const original = Model[method];
      if (typeof original !== 'function') continue;

      Model[method] = function (...args) {
        const result = original.apply(this, args);
        const invalidateNow = () => drop(extractCompanyId(args, companyFrom), `${model}.${method}`);

        // Queries and promises both settle asynchronously — invalidate only
        // once the write has actually landed, and also on failure (the write
        // may have partially applied).
        if (result && typeof result.then === 'function') {
          return result.then(
            (value) => { invalidateNow(); return value; },
            (err) => { invalidateNow(); throw err; }
          );
        }

        invalidateNow();
        return result;
      };

      wrapped.push(`${model}.${method}`);
    }

    // document.save() / document.deleteOne() bypass model statics entirely.
    const proto = Model.prototype;
    for (const docMethod of ['save', 'deleteOne', 'remove']) {
      const original = proto[docMethod];
      if (typeof original !== 'function') continue;

      proto[docMethod] = function (...args) {
        const companyId = companyFrom === 'all'
          ? null
          : (companyFrom === 'self' ? this._id : this[companyFrom]) || null;

        const result = original.apply(this, args);
        const invalidateNow = () => drop(companyId, `${model}.doc.${docMethod}`);

        if (result && typeof result.then === 'function') {
          return result.then(
            (value) => { invalidateNow(); return value; },
            (err) => { invalidateNow(); throw err; }
          );
        }

        invalidateNow();
        return result;
      };

      wrapped.push(`${model}.doc.${docMethod}`);
    }
  }

  logger.info('Entitlement cache hooks installed', {
    models: WATCHED.map((w) => w.model),
    wrappedCount: wrapped.length,
  });
}

module.exports = { install, WATCHED, WRITE_METHODS };
