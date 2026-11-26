import React from 'react';
import { toDisplayDate, toIsoDate } from './winforms';

/**
 * "Month" picker shown in a report window's title bar: choosing a month fills the report's From / To
 * dates with that month (or the whole financial year), so any report can be seen for one month.
 * It only sets the two date boxes; the report itself runs as before.
 */
const DATE_PAIRS = [
  ['txt_dt_from', 'txt_dt_to'],
  ['txt_bill_dt_from', 'txt_bill_dt_to'],
  ['txt_from_date', 'txt_to_date'],
];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function monthPickerPair(form) {
  const names = new Set((form?.controls || []).map((c) => c.name));
  return DATE_PAIRS.find(([a, b]) => names.has(a) && names.has(b)) || null;
}

const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(y, m, 0).getDate(); // m is 1-based

/** The financial year (April start) the From date falls in. */
function fyStartOf(fromDisplay) {
  const iso = toIsoDate(fromDisplay);
  const now = new Date();
  const y = iso ? Number(iso.slice(0, 4)) : now.getFullYear();
  const m = iso ? Number(iso.slice(5, 7)) : now.getMonth() + 1;
  return m >= 4 ? y : y - 1;
}

export function monthOptions(fyStart) {
  const out = [{ key: 'FY', label: `Full Year ${fyStart}-${String(fyStart + 1).slice(2)}`, from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` }];
  for (let i = 0; i < 12; i += 1) {
    const m = ((3 + i) % 12) + 1;
    const y = i < 9 ? fyStart : fyStart + 1;
    out.push({ key: `${y}-${pad(m)}`, label: `${MONTHS[m - 1]}-${y}`, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` });
  }
  return out;
}

export default function JsmMonthPicker({ form, state, onChange }) {
  const pair = monthPickerPair(form);
  if (!pair) return null;
  const [fromName, toName] = pair;
  const fy = fyStartOf(state?.[fromName]);
  const options = monthOptions(fy);
  const from = toIsoDate(state?.[fromName]);
  const to = toIsoDate(state?.[toName]);
  const current = options.find((o) => o.from === from && o.to === to)?.key || '';

  return (
    <label className="jsm-month-picker" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', marginRight: 8, fontSize: 12, fontWeight: 600 }}>
      Month
      <select
        value={current}
        data-month-picker="true"
        onChange={(e) => {
          const o = options.find((x) => x.key === e.target.value);
          if (!o) return;
          onChange((s) => ({ ...s, [fromName]: toDisplayDate(o.from), [toName]: toDisplayDate(o.to) }));
        }}
        style={{ height: 20, fontSize: 12, padding: '0 2px', border: '1px solid #7a7a7a', background: '#fff', color: '#000' }}
        title="Choose a month: the From / To dates are set to it"
      >
        <option value="" disabled>{current ? '' : 'Select…'}</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  );
}
