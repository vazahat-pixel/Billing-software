/** Split label into parts with match highlighted (case-insensitive). */
export function highlightMatch(label, query) {
  const text = String(label ?? '');
  const q = String(query ?? '').trim();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const qi = lower.indexOf(q.toLowerCase());
  if (qi === -1) return [{ text, match: false }];
  const parts = [];
  if (qi > 0) parts.push({ text: text.slice(0, qi), match: false });
  parts.push({ text: text.slice(qi, qi + q.length), match: true });
  if (qi + q.length < text.length) {
    parts.push({ text: text.slice(qi + q.length), match: false });
  }
  return parts;
}
