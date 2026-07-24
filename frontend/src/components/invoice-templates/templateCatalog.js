export const TEMPLATE_CATALOG = [
  {
    id: 'gst-formal',
    name: 'GST Formal',
    blurb: 'Professional tax invoice · grid · GST compliant',
    swatch: ['#111111', '#f3f3f3', '#ffffff'],
  },
  {
    id: 'classic-ledger',
    name: 'Classic Ledger',
    blurb: 'Heritage bill-book · double border · serif',
    swatch: ['#9f1239', '#0f172a', '#fafafa'],
  },
  {
    id: 'corporate-minimal',
    name: 'Corporate Minimal',
    blurb: 'Modern grid · navy/emerald · Stripe-like',
    swatch: ['#0f766e', '#0f172a', '#f8fafc'],
  },
  {
    id: 'gold-letterhead',
    name: 'Gold Letterhead',
    blurb: 'Embossed band · gold/maroon · premium',
    swatch: ['#7f1d1d', '#a16207', '#fffbeb'],
  },
  {
    id: 'festive-edition',
    name: 'Festive Edition',
    blurb: 'Festival motifs · print-safe accents',
    swatch: ['#7f1d1d', '#d97706', '#fff7ed'],
  },
  {
    id: 'compact-thermal',
    name: 'Compact Thermal',
    blurb: '58/80mm POS roll · text-only',
    swatch: ['#000000', '#ffffff', '#e5e5e5'],
  },
];

const LEGACY_MAP = {
  classic: 'classic-ledger',
  compact: 'compact-thermal',
  modern: 'corporate-minimal',
  emerald: 'corporate-minimal',
  slate: 'corporate-minimal',
  minimal: 'corporate-minimal',
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
