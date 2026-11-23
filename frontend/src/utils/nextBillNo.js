import { configApi } from '../api';

/**
 * Where each series keeps its number on the documents already in memory (including bills saved
 * offline and still waiting to upload), so the next number can be worked out without the server.
 */
const LOCAL_SOURCES = {
  sales: { list: 'sales', fields: ['invoiceNo', 'billNo'] },
  purchase: { list: 'purchases', fields: ['srNo', 'serialNo', 'invoiceNo'] },
  job: { list: 'jobWorkEntries', fields: ['challanNo'] },
};

const memoKey = (moduleName) => `erp-next-billno:${moduleName}`;

function remembered(moduleName) {
  try { return Number(localStorage.getItem(memoKey(moduleName))) || 0; } catch { return 0; }
}

function remember(moduleName, next) {
  try { localStorage.setItem(memoKey(moduleName), String(next)); } catch { /* private window */ }
}

async function highestLocal(moduleName) {
  const src = LOCAL_SOURCES[moduleName];
  if (!src) return 0;
  try {
    const { default: useStore } = await import('../store/useStore');
    const docs = useStore.getState()[src.list] || [];
    let max = 0;
    for (const d of docs) {
      for (const f of src.fields) {
        const n = Number(String(d?.[f] ?? '').trim());
        if (Number.isInteger(n) && n > max) max = n;
      }
    }
    return max;
  } catch {
    return 0;
  }
}

/**
 * Next plain bill number (1, 2, 3…) for a series.
 * Online: the server's counter (and it is remembered on this PC).
 * Offline: never "1" again — the higher of the last number the server gave and the highest bill
 * already on this PC (offline bills included), plus one. Starting every offline bill at 1 made it
 * clash with bill 1 already on the cloud, so it could not upload when the internet came back.
 */
export async function peekBillNo(moduleName) {
  try {
    const row = await configApi.peekBillNumber(moduleName);
    const next = Number(row?.next);
    const value = next > 0 ? next : 1;
    remember(moduleName, value);
    return String(value);
  } catch {
    const fromServerMemo = remembered(moduleName);
    const fromBills = (await highestLocal(moduleName)) + 1;
    return String(Math.max(1, fromServerMemo, fromBills));
  }
}
