/** Helpers that turn JSM's WinForms design values (colors, fonts, captions) into CSS. */

const SYSTEM_COLORS = {
  Control: '#f0f0f0',
  ControlLight: '#e3e3e3',
  ControlLightLight: '#ffffff',
  ControlDark: '#a0a0a0',
  ControlDarkDark: '#696969',
  ControlText: '#000000',
  ButtonFace: '#f0f0f0',
  ButtonHighlight: '#ffffff',
  ButtonShadow: '#a0a0a0',
  Window: '#ffffff',
  WindowText: '#000000',
  WindowFrame: '#646464',
  Highlight: '#0078d7',
  HighlightText: '#ffffff',
  GrayText: '#6d6d6d',
  Info: '#ffffe1',
  InfoText: '#000000',
  Menu: '#f0f0f0',
  MenuText: '#000000',
  ScrollBar: '#c8c8c8',
  ActiveCaption: '#99b4d1',
  InactiveCaption: '#bfcddb',
  AppWorkspace: '#ababab',
  GradientActiveCaption: '#b9d1ea',
  GradientInactiveCaption: '#d7e4f2',
  HotTrack: '#0066cc',
};

/** WinForms color name / "#rrggbb" → CSS color. Named web colors (SlateGray, Bisque…) pass through. */
export function cssColor(value) {
  if (!value) return undefined;
  if (value.startsWith('#')) return value;
  if (value === 'Transparent') return 'transparent';
  return SYSTEM_COLORS[value] || value.toLowerCase();
}

/** "Arial|9.75|1" (family|points|FontStyle flags) → CSS font properties. */
export function cssFont(value) {
  if (!value) return {};
  const [family, size, styleFlags] = value.split('|');
  const flags = Number(styleFlags || 0);
  return {
    fontFamily: `"${family}", Arial, sans-serif`,
    fontSize: `${Number(size || 8.25)}pt`,
    fontWeight: flags & 1 ? 700 : 400,
    fontStyle: flags & 2 ? 'italic' : 'normal',
    textDecoration: flags & 4 ? 'underline' : undefined,
  };
}

/** "&Ok" → { text: 'Ok', key: 'o', index: 0 }. "&&" is a literal ampersand. */
export function accel(caption) {
  const raw = String(caption || '');
  let text = '';
  let key = null;
  let index = -1;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '&' && raw[i + 1] === '&') { text += '&'; i += 1; continue; }
    if (raw[i] === '&' && raw[i + 1] && key === null) { index = text.length; key = raw[i + 1].toLowerCase(); continue; }
    text += raw[i];
  }
  return { text, key, index };
}

/** dd/MM/yyyy ⇄ yyyy-MM-dd, as JSM's masked date boxes show dates. */
export function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

export function toIsoDate(display) {
  const m = String(display || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
