const Book = require('../models/Book');

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
  millIssue: [
    { name: 'PROCESS ISSUE BOOK', code: '105' }
  ],
  millRec: [
    { name: 'PROCESS RECEIVE BOOK', code: '106' }
  ],
  jobIssue: [
    { name: 'JOB WORK ISSUE BOOK', code: '107' }
  ],
  jobRec: [
    { name: 'JOB WORK RECEIVE BOOK', code: '108' }
  ],
  ledger: [
    { name: 'LEDGER BOOK', code: '109' }
  ]
};

/**
 * FIXED: Default books are now seeded into DB (with companyId: null = system books).
 * This ensures all books have _id fields, so delete buttons work correctly in the frontend.
 */
async function ensureDefaultBooksExist(module) {
  const defaults = DEFAULT_BOOKS[module] || [];
  for (const b of defaults) {
    await Book.findOneAndUpdate(
      { module, code: b.code, companyId: null },
      { name: b.name, code: b.code, module, companyId: null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

exports.getAllBooks = async (req, res) => {
  try {
    const companyId = req.companyId;

    // Ensure system default books exist in DB for all modules
    const modules = Object.keys(DEFAULT_BOOKS);
    for (const module of modules) {
      await ensureDefaultBooksExist(module);
    }

    // Fetch both system books (companyId: null) and company-specific custom books
    const query = {
      $or: [
        { companyId: null },
        { companyId: companyId }
      ]
    };

    const books = await Book.find(query).sort({ module: 1, code: 1 });
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBooksByModule = async (req, res) => {
  try {
    const { module } = req.params;
    const companyId = req.companyId;

    if (!module) {
      return res.status(400).json({ success: false, message: 'Module is required' });
    }

    // Ensure system default books exist in DB (idempotent upsert)
    await ensureDefaultBooksExist(module);

    // Fetch both system books (companyId: null) and company-specific custom books
    const query = {
      module,
      $or: [
        { companyId: null },
        { companyId: companyId }
      ]
    };

    const books = await Book.find(query).sort({ code: 1 });
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBook = async (req, res) => {
  try {
    const { name, code, module } = req.body;
    const companyId = req.companyId;

    if (!name || !code || !module) {
      return res.status(400).json({ success: false, message: 'Name, code, and module are required' });
    }

    // Check for code collision with system books
    const codeConflict = await Book.findOne({ module, code });
    if (codeConflict) {
      return res.status(400).json({ success: false, message: `Book code '${code}' is already in use for this module` });
    }

    const newBook = new Book({
      name: name.toUpperCase(),
      code,
      module,
      companyId: companyId || null,
      bookType: req.body.bookType || 'SALES BOOK',
      groupHead: req.body.groupHead || '',
      opBalance: Number(req.body.opBalance || 0),
      opBalanceType: req.body.opBalanceType === 'CR' ? 'CR' : 'DR',
      accountNo: req.body.accountNo || '',
      gstinNo: req.body.gstinNo || '',
      stateCode: req.body.stateCode != null ? String(req.body.stateCode) : '0',
      stateName: req.body.stateName || '',
      gstType: req.body.gstType || '',
      retailTax: req.body.retailTax || '',
      detailJobWork: req.body.detailJobWork || 'D',
      rowFinishMaterial: req.body.rowFinishMaterial || 'F',
      incExcVat: req.body.incExcVat || '',
      effectOnStock: req.body.effectOnStock || 'N',
      address1: req.body.address1 || '',
      address2: req.body.address2 || '',
      dist: req.body.dist || '',
      state: req.body.state || '',
      head1: req.body.head1 || 'Pcs',
      head2: req.body.head2 || 'Qty',
      createDate: req.body.createDate ? new Date(req.body.createDate) : new Date(),
      notes: req.body.notes || '',
      jobWorkBook: !!req.body.jobWorkBook,
      tdsHead: req.body.tdsHead || '',
      tdsCode: Number(req.body.tdsCode || 0)
    });

    await newBook.save();
    res.status(201).json({ success: true, data: newBook });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A book with this name or code already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (!book.companyId) {
      return res.status(403).json({ success: false, message: 'Cannot edit system default books' });
    }
    if (book.companyId.toString() !== companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this book' });
    }

    const fields = [
      'name', 'code', 'module', 'bookType', 'groupHead', 'opBalance', 'opBalanceType',
      'accountNo', 'gstinNo', 'stateCode', 'stateName', 'gstType', 'retailTax',
      'detailJobWork', 'rowFinishMaterial', 'incExcVat', 'effectOnStock',
      'address1', 'address2', 'dist', 'state', 'head1', 'head2', 'createDate',
      'notes', 'jobWorkBook', 'tdsHead', 'tdsCode'
    ];

    for (const key of fields) {
      if (req.body[key] === undefined) continue;
      if (key === 'name') book.name = String(req.body.name).toUpperCase();
      else if (key === 'opBalance' || key === 'tdsCode') book[key] = Number(req.body[key] || 0);
      else if (key === 'opBalanceType') book.opBalanceType = req.body.opBalanceType === 'CR' ? 'CR' : 'DR';
      else if (key === 'jobWorkBook') book.jobWorkBook = !!req.body.jobWorkBook;
      else if (key === 'createDate') book.createDate = req.body.createDate ? new Date(req.body.createDate) : book.createDate;
      else if (key === 'stateCode') book.stateCode = String(req.body.stateCode);
      else book[key] = req.body[key];
    }

    await book.save();
    res.status(200).json({ success: true, data: book });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A book with this name or code already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Prevent deleting system books (companyId: null)
    if (!book.companyId) {
      return res.status(403).json({ success: false, message: 'Cannot delete system default books' });
    }

    // Prevent deleting another company's custom books
    if (book.companyId.toString() !== companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this book' });
    }

    await book.deleteOne();
    res.status(200).json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
