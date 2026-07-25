export const TEMPLATE_CATALOG = [
  {
    id: 'gst-formal',
    name: 'GST Formal',
    blurb: 'Textile tax invoice · full GST grid',
    swatch: ['#111111', '#f3f4f6', '#ffffff'],
  },
  {
    id: 'erp-classic',
    name: 'ERP Classic',
    blurb: 'Busy / Tally style · dense ledger',
    swatch: ['#0f172a', '#e2e8f0', '#f8fafc'],
  },
  {
    id: 'commerce-pro',
    name: 'Commerce Pro',
    blurb: 'Modern CRM · teal accent band',
    swatch: ['#0f766e', '#ecfdf5', '#ffffff'],
  },
  {
    id: 'executive',
    name: 'Executive',
    blurb: 'Navy letterhead · corporate premium',
    swatch: ['#0b1f3a', '#1e3a5f', '#e8eef5'],
  },
  {
    id: 'compact-thermal',
    name: 'Thermal POS',
    blurb: '58/80mm roll · counter print',
    swatch: ['#000000', '#ffffff', '#e5e5e5'],
  },
];

/** Map old / deleted template ids → current professional set */
const LEGACY_MAP = {
  classic: 'erp-classic',
  'classic-ledger': 'erp-classic',
  compact: 'compact-thermal',
  modern: 'commerce-pro',
  emerald: 'commerce-pro',
  slate: 'commerce-pro',
  minimal: 'commerce-pro',
  'corporate-minimal': 'commerce-pro',
  'gold-letterhead': 'executive',
  'festive-edition': 'gst-formal',
  formal: 'gst-formal',
  'tax-invoice': 'gst-formal',
};

export function normalizeTemplateId(id) {
  if (!id) return 'gst-formal';
  if (LEGACY_MAP[id]) return LEGACY_MAP[id];
  if (TEMPLATE_CATALOG.some((t) => t.id === id)) return id;
  return 'gst-formal';
}

export const INVOICE_TEMPLATE_IDS = TEMPLATE_CATALOG.map((t) => t.id);
