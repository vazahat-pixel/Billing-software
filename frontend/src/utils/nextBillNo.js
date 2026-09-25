import { configApi } from '../api';

/** Next plain bill number (1, 2, 3…) for a series. Falls back to 1 if the API is unreachable. */
export async function peekBillNo(moduleName) {
  try {
    const row = await configApi.peekBillNumber(moduleName);
    const next = Number(row?.next);
    return String(next > 0 ? next : 1);
  } catch {
    return '1';
  }
}
