/**
 * Common validators for Sprint 1.2 — extend per module in Sprint 1.3.
 */
const { validateBody, validateObjectIdParam } = require('../middlewares/validate.middleware');
const { PARTY_TYPES, ITEM_CATEGORIES, SALE_STATUS, PURCHASE_STATUS } = require('../constants/statuses');

const partyCreate = validateBody({
  name: { required: true, type: 'string' },
  type: { required: false, type: 'string', enum: PARTY_TYPES },
  email: { required: false, type: 'email' },
  mobile: { required: false, type: 'string' },
});

const itemCreate = validateBody({
  name: { required: false, type: 'string' },
  itemName: { required: false, type: 'string' },
  category: { required: false, type: 'string', enum: ITEM_CATEGORIES },
  gstRate: { required: false, type: 'number', min: 0, max: 28 },
});

const saleStatus = validateBody({
  status: { required: true, type: 'string', enum: SALE_STATUS },
});

const purchaseStatus = validateBody({
  status: { required: true, type: 'string', enum: PURCHASE_STATUS },
});

const objectIdParam = validateObjectIdParam('id');

module.exports = {
  partyCreate,
  itemCreate,
  saleStatus,
  purchaseStatus,
  objectIdParam,
};
