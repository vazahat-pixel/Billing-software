import { get, post, unwrap, asArray } from './http';

export const inventoryApi = {
  list: () => unwrap(get('/inventory')).then((d) => asArray(d, ['lots', 'inventory'])),
  lots: () => unwrap(get('/inventory/lots')).then((d) => asArray(d, ['lots'])),
  lot: (lotId) => unwrap(get(`/inventory/lot/${lotId}`)),
  stockByItem: (itemId) => unwrap(get(`/inventory/stock/${itemId}`)),
  openingStock: (body) => unwrap(post('/inventory/opening-stock', body)),
};

export default inventoryApi;
