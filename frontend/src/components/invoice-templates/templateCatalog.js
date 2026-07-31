export const TEMPLATE_CATALOG = [
  {
    id: 'surat-bold',
    name: 'Surat Bold',
    blurb: 'Navy header · Gold accents · Full textile GST details',
    swatch: ['#0f2f5a', '#c9a84c', '#f0f5ff'],
    preview: '🧵 Textile ERP Classic',
    badge: 'RECOMMENDED',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    blurb: 'Luxury gold letterhead · Cream paper · Elegant typography',
    swatch: ['#1a0e00', '#b8921a', '#fffdf5'],
    preview: '👑 Premium Luxury',
    badge: 'PREMIUM',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    blurb: 'Corporate blue header · Card layout · Modern sans-serif',
    swatch: ['#1565c0', '#00838f', '#e3f2fd'],
    preview: '🌊 Corporate Modern',
    badge: 'NEW',
  },
  {
    id: 'slate-elegant',
    name: 'Slate Elegant',
    blurb: 'Dark charcoal header · Green accent · Contemporary clean',
    swatch: ['#1e293b', '#10b981', '#f1f5f9'],
    preview: '⚡ Contemporary',
    badge: 'NEW',
  },
  {
    id: 'textile-pro',
    name: 'Textile Pro (Classic)',
    blurb: 'Surat GST tax invoice · full bordered grid',
    swatch: ['#000000', '#ffffff', '#f0f0f0'],
    preview: '📄 Classic Grid',
  },
  {
    id: 'modern-enterprise',
    name: 'Modern Enterprise',
    blurb: 'SAP-style · split header · GST audit grid',
    swatch: ['#111111', '#f7f7f7', '#ffffff'],
    preview: '🏢 Enterprise ERP',
  },
  {
    id: 'luxury-corporate',
    name: 'Luxury Corporate',
    blurb: 'Letterhead · framed customer · ledger totals',
    swatch: ['#1a1a1a', '#e8e8e8', '#ffffff'],
    preview: '💼 Luxury',
  },
  {
    id: 'premium-minimal',
    name: 'Premium Minimal',
    blurb: 'Whitespace · hairline table · inline totals',
    swatch: ['#2d2d2d', '#fafafa', '#ffffff'],
    preview: '✨ Minimal',
  },
  {
    id: 'international-biz',
    name: 'International Business',
    blurb: 'Export-ready · tax summary · payment box',
    swatch: ['#0d0d0d', '#ececec', '#ffffff'],
    preview: '🌐 International',
  },
  {
    id: 'compact-thermal',
    name: 'Thermal POS',
    blurb: '58/80mm roll · counter print',
    swatch: ['#000000', '#ffffff', '#e5e5e5'],
    preview: '🖨️ Thermal POS',
  },
];

/** Map legacy template ids → current professional set */
const LEGACY_MAP = {
  'gst-formal': 'surat-bold',
  'erp-classic': 'surat-bold',
  'commerce-pro': 'premium-minimal',
  executive: 'royal-gold',
  'premium-orange': 'royal-gold',
  classic: 'surat-bold',
  'classic-ledger': 'textile-pro',
  compact: 'compact-thermal',
  modern: 'modern-enterprise',
  emerald: 'slate-elegant',
  slate: 'slate-elegant',
  minimal: 'premium-minimal',
  'corporate-minimal': 'premium-minimal',
  'gold-letterhead': 'royal-gold',
  'festive-edition': 'royal-gold',
  formal: 'surat-bold',
  'tax-invoice': 'surat-bold',
  premium: 'royal-gold',
};

export function normalizeTemplateId(id) {
  if (!id) return 'surat-bold';
  if (LEGACY_MAP[id]) return LEGACY_MAP[id];
  if (TEMPLATE_CATALOG.some((t) => t.id === id)) return id;
  return 'surat-bold';
}

export const INVOICE_TEMPLATE_IDS = TEMPLATE_CATALOG.map((t) => t.id);
