/** System default books — mirrors backend bookController DEFAULT_BOOKS */

const DEFAULT_BOOKS = {
  sales: [
    { name: 'GREY SALES', code: '96' },
    { name: 'SALES BOOK', code: '101' }
  ],
  purchase: [
    { name: 'GREY PURCHASE', code: '97' },
    { name: 'PURCHASE BOOK', code: '102' }
  ],
  receipt: [
    { name: 'BANK RECEIPT BOOK', code: '103' },
    { name: 'CASH RECEIPT BOOK', code: '113' }
  ],
  payment: [
    { name: 'BANK PAYMENT BOOK', code: '104' },
    { name: 'CASH PAYMENT BOOK', code: '114' }
  ],
  millIssue: [{ name: 'PROCESS ISSUE BOOK', code: '105' }],
  millRec: [{ name: 'PROCESS RECEIVE BOOK', code: '106' }],
  jobIssue: [{ name: 'JOB WORK ISSUE BOOK', code: '107' }],
  jobRec: [{ name: 'JOB WORK RECEIVE BOOK', code: '108' }],
  ledger: [{ name: 'LEDGER BOOK', code: '109' }]
};

export const getDefaultBooksForModule = (moduleName) => {
  const list = DEFAULT_BOOKS[moduleName] || [];
  return list.map((b) => ({
    ...b,
    module: moduleName,
    id: `default-${moduleName}-${b.code}`,
    _id: `default-${moduleName}-${b.code}`
  }));
};

export default DEFAULT_BOOKS;
