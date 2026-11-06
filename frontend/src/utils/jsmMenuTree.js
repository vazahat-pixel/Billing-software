import menu from '../jsm/blueprint/menu.json' with { type: 'json' };
import { FORM_HANDLERS, PATH_HANDLERS } from './jsmMenuHandlers.js';

/**
 * The Reports menu, built from JSM's own menu — the same folders, in the same order, with the
 * same wording, down to every last entry.
 *
 * menu.json is a capture of the real JSM installation's menu, so this tree cannot drift from it.
 * An entry opens a screen when jsmMenuHandlers.js names one for it; every other JSM entry is
 * still listed, in its own place, marked `soon` so the operator can see it exists and is not
 * ready rather than wondering where it went.
 */

/** A stable id for an entry JSM has but this software does not serve yet. */
const slug = (path) => `jsm-${path.join('-')}`
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

function build(items, trail, seen) {
  return items.map((item) => {
    const caption = item.caption || '';
    const path = [...trail, caption];

    if (item.items?.length) {
      return { id: slug(path), label: caption, children: build(item.items, path, seen) };
    }

    const handler = PATH_HANDLERS[path.join(' > ')] || (item.form ? FORM_HANDLERS[item.form] : null);
    const node = handler
      ? { label: caption, jsmPath: path.join(' > '), ...handler }
      : { id: slug(path), label: caption, jsmPath: path.join(' > '), soon: true };

    // JSM lists one screen under two entries now and then (its Sales register sits under both
    // Sales Bill and Monthly Reports). The handler's id can therefore repeat, and an id has to
    // be unique for the hub to select and expand to the right entry — so a repeat falls back to
    // the entry's own path.
    if (seen.has(node.id)) node.id = slug(path);
    seen.add(node.id);
    return node;
  });
}

const seenIds = new Set();

/** JSM's "Reports" menu. */
export const JSM_REPORTS_TREE = build(menu.find((m) => m.caption === 'Reports')?.items || [], ['Reports'], seenIds);

/** JSM's "Others Reports" menu. */
export const JSM_OTHERS_TREE = build(menu.find((m) => m.caption === 'Others Reports')?.items || [], ['Others Reports'], seenIds);

/** Every leaf of a tree, with the folder path that leads to it. */
export function leavesOf(nodes, trail = []) {
  const out = [];
  for (const n of nodes) {
    const path = [...trail, n.label];
    if (n.children?.length) out.push(...leavesOf(n.children, path));
    else out.push({ ...n, path });
  }
  return out;
}
