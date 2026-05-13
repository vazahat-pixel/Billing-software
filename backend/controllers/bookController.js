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

exports.getBooksByModule = async (req, res) => {
  try {
    const { module } = req.params;
    const companyId = req.companyId;

    if (!module) {
      return res.status(400).json({ success: false, message: 'Module is required' });
    }

    // Find custom books for this company
    const query = { module };
    if (companyId) {
      query.$or = [
        { companyId },
        { companyId: null }
      ];
    } else {
      query.companyId = null;
    }

    let books = await Book.find(query).sort({ code: 1 });

    // If no books exist in DB, fallback to default books for this module
    if (books.length === 0 && DEFAULT_BOOKS[module]) {
      books = DEFAULT_BOOKS[module].map(b => ({
        ...b,
        module,
        companyId: companyId || null
      }));
    }

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

    // Create a new custom book
    const newBook = new Book({
      name,
      code,
      module,
      companyId: companyId || null
    });

    await newBook.save();
    res.status(201).json({ success: true, data: newBook });
  } catch (error) {
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

    // Ensure users can only delete custom books of their own company
    if (book.companyId && book.companyId.toString() !== companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this book' });
    }

    if (!book.companyId) {
      return res.status(403).json({ success: false, message: 'Cannot delete global system books' });
    }

    await book.deleteOne();
    res.status(200).json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
