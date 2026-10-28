/**
 * Which JSM form draws each simple master, and where each JSM box is saved.
 * Keys in `fields` are the extraFields names the older master screen already used, so records
 * saved by either screen open in the other unchanged.
 */
export const JSM_SUBMASTER_FORMS = {
  City: {
    form: 'mst_station',
    name: 'txt_name',
    fields: {
      txt_dist: 'dist', txt_state: 'state', txt_pin_code: 'pincode', txt_Manual_Code: 'code',
      txt_distance: 'distance', txt_state_code: 'stateCode', txt_StateName: 'jsmStateName',
    },
    defaults: { txt_Manual_Code: '0', txt_distance: '0', txt_state_code: '0' },
  },
  Transport: {
    form: 'mst_transport',
    name: 'txt_name',
    fields: {
      txt_add1: 'address1', txt_add2: 'address2', txt_city: 'city', TXT_PINCODE: 'pincode', TXT_STATE: 'state',
      txt_ph1: 'phone', txt_gstn_no: 'transporterId', TXT_MAIL: 'email', txt_pname: 'party', TXT_MODE: 'mode',
      txt_Manual_Code: 'code',
    },
    defaults: { txt_Manual_Code: '0' },
    upper: ['txt_gstn_no'],
    // JSM Fill_Form ticks the radio that matches the saved mode
    radios: { Radio_Road: ['TXT_MODE', 'Road'], Radio_Rail: ['TXT_MODE', 'Rail'], Radio_Air: ['TXT_MODE', 'Air'], Radio_Ship: ['TXT_MODE', 'Ship'] },
  },
  Unit: {
    form: 'mst_unit',
    name: 'txt_name',
    fields: { CBO_quc: 'quc', txt_Manual_Code: 'code' },
    defaults: { txt_Manual_Code: '0' },
  },
  Type: {
    form: 'mst_typemn',
    name: 'txt_name',
    fields: { cbo_region: 'region', cbo_tx_calc: 'taxCalculation', txt_Manual_Code: 'code' },
    // filled in JSM's Form_Load
    options: { cbo_region: ['LOCAL (WITHIN STATE)', 'CENTRAL (OUT OF STATE)'], cbo_tx_calc: ['TAX INVOICE', 'RETAIL INVOICE'] },
    defaults: { txt_Manual_Code: '0' },
  },
  ItemGroup: {
    form: 'Mst_Item_Group',
    name: 'txt_name',
    fields: { txt_Manual_Code: 'code' },
    defaults: { txt_Manual_Code: '0' },
  },
  ItemTaxSlab: {
    form: 'Mst_Tax_Slab',
    name: 'txt_slab_name',
    // JSM's GST/VAT goes to taxCategory; the older Goods/Services `category` is left as it is
    fields: {
      cbo_cat_tax: 'taxCategory', txt_sgst_per: 'sgstRate', txt_cgst_per: 'cgstRate', txt_igst_per: 'igstRate',
      txt_cess_per: 'cessRate', Txt_Slab_code: 'code',
    },
    numeric: ['txt_sgst_per', 'txt_cgst_per', 'txt_igst_per', 'txt_cess_per'],
    defaults: { cbo_cat_tax: 'GST', txt_sgst_per: '0.000', txt_cgst_per: '0.000', txt_igst_per: '0.00', txt_cess_per: '0.00' },
    // number format JSM applies when leaving the box
    decimals: { txt_sgst_per: 3, txt_cgst_per: 3, txt_igst_per: 2, txt_cess_per: 2 },
    align: { txt_sgst_per: 'right', txt_cgst_per: 'right', txt_igst_per: 'right', txt_cess_per: 'right' },
  },
  BookType: { form: 'Mst_BookType', name: 'txt_name', fields: {} },
  PartyBank: { form: 'mst_drawmn', name: 'txt_name', fields: { txt_Manual_Code: 'code' }, defaults: { txt_Manual_Code: '0' } },
  Area: { form: 'Mst_Area', name: 'txt_name', fields: { txt_Manual_Code: 'code' }, defaults: { txt_Manual_Code: '0' } },
  Color: { form: 'Mst_Colour', name: 'txt_name', fields: { txt_Manual_Code: 'code' }, defaults: { txt_Manual_Code: '0' } },
  Size: { form: 'Mst_Size', name: 'txt_name', fields: { txt_Manual_Code: 'code' }, defaults: { txt_Manual_Code: '0' } },
};

/** Record -> values keyed by JSM box name. */
export function recordToValues(cfg, rec) {
  const ex = rec?.extraFields || {};
  const v = { [cfg.name]: rec?.name || '' };
  for (const [box, key] of Object.entries(cfg.fields)) {
    let val = ex[key];
    if (val == null || val === '') val = cfg.defaults?.[box] ?? '';
    if (cfg.decimals?.[box] != null && val !== '' && Number.isFinite(Number(val))) val = Number(val).toFixed(cfg.decimals[box]);
    v[box] = String(val);
  }
  return v;
}

/** Values -> API payload; fields this screen does not show are carried over from the record. */
export function valuesToPayload(cfg, type, values, rec, nextCode) {
  const extraFields = { ...(rec?.extraFields || {}) };
  for (const [box, key] of Object.entries(cfg.fields)) {
    let val = String(values[box] ?? '').trim();
    if (cfg.upper?.includes(box)) val = val.toUpperCase();
    extraFields[key] = cfg.numeric?.includes(box) ? Number(val || 0) : val;
  }
  if ('code' in extraFields && (!extraFields.code || extraFields.code === '0') && nextCode != null) {
    extraFields.code = String(nextCode);
  }
  if (type === 'ItemTaxSlab') extraFields.gstRate = Number(extraFields.igstRate || 0); // as the older screen saved
  return { type, name: String(values[cfg.name] ?? '').trim(), extraFields };
}

/** JSM's next number for the auto Code box. */
export function nextCodeOf(records) {
  let max = 0;
  for (const r of records) {
    const n = Number(r?.extraFields?.code);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** GSTIN format and check digit (15th character), as JSM validGSTIN. */
export function isValidGstin(value) {
  const g = String(value || '').trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z0-9]{10}[1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const p = chars.indexOf(g[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return chars[(36 - (sum % 36)) % 36] === g[14];
}
