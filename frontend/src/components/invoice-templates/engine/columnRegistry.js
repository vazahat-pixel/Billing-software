/**
 * Dynamic print column registry — drives item table across all templates.
 * New columns / presets can be added without touching template layouts.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

const str = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

export const COLUMN_DEFS = {
  sno: {
    id: 'sno',
    key: 'sno',
    label: 'Sr',
    width: '3.5%',
    align: 'center',
    getValue: (line) => line.sno,
  },
  item: {
    id: 'item',
    key: 'name',
    label: 'Description of Goods',
    width: '28%',
    align: 'left',
    getValue: (line) => line.name,
    renderSub: (line) => {
      const parts = [line.desc, line.lot, line.designNo, line.colour, line.quality]
        .map(str)
        .filter(Boolean);
      return parts.length ? parts.join(' · ') : null;
    },
  },
  hsn: {
    id: 'hsn',
    key: 'hsn',
    label: 'HSN ACS',
    width: '9%',
    align: 'center',
    getValue: (line) => line.hsn || '—',
  },
  batch: {
    id: 'batch',
    key: 'batch',
    label: 'Batch',
    width: '6%',
    align: 'center',
    getValue: (line) => line.batch,
    isEmpty: (line) => !str(line.batch),
  },
  lot: {
    id: 'lot',
    key: 'lot',
    label: 'Lot',
    width: '6%',
    align: 'center',
    getValue: (line) => line.lot,
    isEmpty: (line) => !str(line.lot),
  },
  fold: {
    id: 'fold',
    key: 'fold',
    label: 'Fold',
    width: '5%',
    align: 'right',
    getValue: (line) => num(line.fold),
    isEmpty: (line) => num(line.fold) == null,
  },
  cut: {
    id: 'cut',
    key: 'cut',
    label: 'Cut',
    width: '5%',
    align: 'right',
    getValue: (line) => num(line.cut),
    isEmpty: (line) => num(line.cut) == null,
  },
  pcs: {
    id: 'pcs',
    key: 'pcs',
    label: 'Pcs',
    width: '5%',
    align: 'right',
    getValue: (line) => num(line.pcs),
    isEmpty: (line) => num(line.pcs) == null,
  },
  mts: {
    id: 'mts',
    key: 'mts',
    label: 'Mtrs',
    width: '6%',
    align: 'right',
    getValue: (line) => {
      const u = String(line.unit || 'MTRS').toUpperCase();
      const isMeter = ['MTRS', 'MTS', 'QTY', 'NETQTY'].includes(u);
      return isMeter ? num(line.mts) : 0;
    },
    isEmpty: (line) => num(line.mts) == null,
  },
  netMts: {
    id: 'netMts',
    key: 'netMts',
    label: 'Net Mtrs',
    width: '6%',
    align: 'right',
    getValue: (line) => {
      const u = String(line.unit || 'MTRS').toUpperCase();
      const isMeter = ['MTRS', 'MTS', 'QTY', 'NETQTY'].includes(u);
      if (!isMeter) return 0;
      // If pcsDetails exist, sum netQty from breakdown
      let grossMts = Number(line.mts) || 0;
      if (Array.isArray(line.pcsDetails) && line.pcsDetails.length > 0) {
        const sum = line.pcsDetails.reduce((s, r) => {
          const rowPcs = Number(r.pcs ?? r.qty) || 0;
          const qtyBndl = Number(r.qtyBndl ?? r.qtyPerBndl) || 0;
          if (rowPcs > 0 && qtyBndl > 0) return s + rowPcs * qtyBndl;
          return s + (Number(r.netQty ?? r.kgs) || 0);
        }, 0);
        if (sum > 0) grossMts = Number(sum.toFixed(3));
      }
      const rawMts = grossMts;
      const fold = Number(line.fold || 0);
      if (rawMts > 0 && fold > 0 && fold < 100) {
        return Number(((rawMts * fold) / 100).toFixed(3));
      }
      return rawMts > 0 ? rawMts : 0;
    },
    isEmpty: (line) => num(line.mts) == null,
  },
  qty: {
    id: 'qty',
    key: 'qty',
    label: 'Qty',
    width: '6%',
    align: 'right',
    getValue: (line) => num(line.qty) ?? num(line.mts) ?? num(line.pcs),
    isEmpty: (line) => num(line.qty) == null && num(line.mts) == null && num(line.pcs) == null,
  },
  weight: {
    id: 'weight',
    key: 'weight',
    label: 'Wt (Kg)',
    width: '6%',
    align: 'right',
    getValue: (line) => num(line.weight),
    isEmpty: (line) => num(line.weight) == null,
  },
  rate: {
    id: 'rate',
    key: 'rate',
    label: 'Rate',
    width: '8%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.rate,
  },
  discount: {
    id: 'discount',
    key: 'discount',
    label: 'Disc',
    width: '6%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.discount,
    isEmpty: (line) => !num(line.discount),
  },
  taxable: {
    id: 'taxable',
    key: 'taxable',
    label: 'Taxable',
    width: '8%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.taxable,
  },
  gst: {
    id: 'gst',
    key: 'gstPer',
    label: 'GST%',
    width: '5%',
    align: 'center',
    getValue: (line) => (line.gstPer ? `${line.gstPer}%` : '—'),
  },
  gstAmt: {
    id: 'gstAmt',
    key: 'gstAmt',
    label: 'Tax Amt',
    width: '7%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.gstAmt,
    isEmpty: (line) => !num(line.gstAmt),
  },
  amount: {
    id: 'amount',
    key: 'amount',
    label: 'Amount Rs.',
    width: '11%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.amount,
  },
  remarks: {
    id: 'remarks',
    key: 'remarks',
    label: 'Remarks',
    width: '10%',
    align: 'left',
    getValue: (line) => line.remarks,
    isEmpty: (line) => !str(line.remarks),
  },
  designNo: {
    id: 'designNo',
    key: 'designNo',
    label: 'Design',
    width: '7%',
    align: 'center',
    getValue: (line) => line.designNo,
    isEmpty: (line) => !str(line.designNo),
  },
  colour: {
    id: 'colour',
    key: 'colour',
    label: 'Colour',
    width: '7%',
    align: 'center',
    getValue: (line) => line.colour,
    isEmpty: (line) => !str(line.colour),
  },
  quality: {
    id: 'quality',
    key: 'quality',
    label: 'Quality',
    width: '7%',
    align: 'center',
    getValue: (line) => line.quality,
    isEmpty: (line) => !str(line.quality),
  },
  grey: {
    id: 'grey',
    key: 'grey',
    label: 'Grey',
    width: '6%',
    align: 'center',
    getValue: (line) => line.grey,
    isEmpty: (line) => !str(line.grey),
  },
  finish: {
    id: 'finish',
    key: 'finish',
    label: 'Finish',
    width: '6%',
    align: 'center',
    getValue: (line) => line.finish,
    isEmpty: (line) => !str(line.finish),
  },
  bale: {
    id: 'bale',
    key: 'bale',
    label: 'Bale',
    width: '5%',
    align: 'center',
    getValue: (line) => line.bale,
    isEmpty: (line) => !str(line.bale),
  },
  roll: {
    id: 'roll',
    key: 'roll',
    label: 'Roll',
    width: '5%',
    align: 'center',
    getValue: (line) => line.roll,
    isEmpty: (line) => !str(line.roll),
  },
  fabricWidth: {
    id: 'fabricWidth',
    key: 'fabricWidth',
    label: 'Width',
    width: '5%',
    align: 'center',
    getValue: (line) => line.fabricWidth,
    isEmpty: (line) => !str(line.fabricWidth),
  },
  unit: {
    id: 'unit',
    key: 'unit',
    label: 'Per/Unit',
    width: '6%',
    align: 'center',
    getValue: (line) => line.unit || 'MTRS',
  },
  dis1Per: {
    id: 'dis1Per',
    key: 'dis1Per',
    label: 'DIS1%',
    width: '5%',
    align: 'center',
    getValue: (line) => (line.dis1Per ? `${line.dis1Per}%` : '0.00'),
    isEmpty: (line) => !num(line.dis1Per),
  },
  dis1Amt: {
    id: 'dis1Amt',
    key: 'dis1Amt',
    label: 'DISAMT',
    width: '6%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.dis1Amt,
    isEmpty: (line) => !num(line.dis1Amt),
  },
  dis2Per: {
    id: 'dis2Per',
    key: 'dis2Per',
    label: 'DIS2%',
    width: '5%',
    align: 'center',
    getValue: (line) => (line.dis2Per ? `${line.dis2Per}%` : '0.00'),
    isEmpty: (line) => !num(line.dis2Per),
  },
  dis2Amt: {
    id: 'dis2Amt',
    key: 'dis2Amt',
    label: 'DISAMT.',
    width: '6%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.dis2Amt,
    isEmpty: (line) => !num(line.dis2Amt),
  },
  addAmt: {
    id: 'addAmt',
    key: 'addAmt',
    label: 'AddAmt',
    width: '5%',
    align: 'right',
    format: 'money',
    getValue: (line) => line.addAmt,
    isEmpty: (line) => !num(line.addAmt),
  },
};

/** Preset column sets per template / business type */
export const COLUMN_PRESETS = {
  standard: ['sno', 'item', 'hsn', 'qty', 'rate', 'amount'],
  gstDetailed: ['sno', 'item', 'hsn', 'qty', 'rate', 'taxable', 'gst', 'gstAmt', 'amount'],
  /** Surat textile tax invoice — matches classic ERP print format (Fold, Cut, Pcs, Mtrs, Net Mtrs, Rate, Amount) */
  textileClassic: ['sno', 'item', 'hsn', 'fold', 'cut', 'pcs', 'mts', 'netMts', 'rate', 'amount'],
  textileSuratFull: [
    'sno', 'item', 'hsn', 'fold', 'cut', 'pcs', 'mts', 'netMts', 'rate', 'amount',
  ],
  textile: ['sno', 'item', 'hsn', 'lot', 'fold', 'cut', 'pcs', 'mts', 'rate', 'discount', 'amount'],
  textileFull: [
    'sno', 'item', 'hsn', 'lot', 'designNo', 'colour', 'fold', 'cut', 'pcs', 'mts',
    'weight', 'rate', 'discount', 'amount',
  ],
  international: ['sno', 'item', 'qty', 'rate', 'taxable', 'gstAmt', 'amount'],
  minimal: ['sno', 'item', 'qty', 'rate', 'amount'],
};

const TEMPLATE_PRESETS = {
  'modern-enterprise': 'gstDetailed',
  'luxury-corporate': 'standard',
  'premium-minimal': 'minimal',
  'textile-pro': 'textileSuratFull',
  'international-biz': 'international',
};

/**
 * Resolve visible columns for a print job.
 * Drops columns that have no data across all lines (except core columns).
 */
export function resolvePrintColumns({ templateId, lines = [], businessType = '', columnIds } = {}) {
  const presetKey = columnIds || TEMPLATE_PRESETS[templateId] || 'standard';
  const preset = COLUMN_PRESETS[presetKey] || COLUMN_PRESETS.standard;
  const core = new Set(['sno', 'item', 'rate', 'amount', 'qty']);

  const isTextile = /textile|fabric|garment|weaving|processing/i.test(businessType || '');
  let ids = [...preset];
  if (isTextile && presetKey === 'standard') {
    ids = COLUMN_PRESETS.textile;
  }

  const cols = ids.map((id) => COLUMN_DEFS[id]).filter(Boolean);

  const visible = cols.filter((col) => {
    if (presetKey === 'textileSuratFull' || presetKey === 'textileClassic') return true;
    if (core.has(col.id)) return true;
    if (!col.isEmpty) return true;
    return lines.some((line) => !col.isEmpty(line));
  });

  return visible.map((col) => {
    if (col.id === 'mts' && presetKey !== 'textileSuratFull' && presetKey !== 'textileClassic') {
      const useKg = lines.some((l) => /KG/i.test(l.unit || ''));
      if (useKg) return { ...col, label: 'Kgs' };
    }
    return col;
  });
}

export function formatCellValue(col, line, fmt) {
  const raw = col.getValue(line);
  // For numeric / money columns, show 0.00 instead of '—' so empty fields still display
  if (raw == null || raw === '') {
    if (col.format === 'money') return '0.00';
    if (col.id === 'pcs' || col.id === 'mts' || col.id === 'netMts' || col.id === 'cut' || col.id === 'fold') return '0.00';
    return '';
  }
  if (col.format === 'money') return fmt.money(raw).replace(/^₹\s*/, '');
  if (col.format === 'num') return fmt.num(raw);
  return raw;
}
