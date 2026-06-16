const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' }); // Assuming there is a .env file
const Book = require('./models/Book');

async function fixBooks() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/billing_software');
    console.log('Connected to DB');
    
    // Find books in sales module with code "9\" or "v"
    const booksToDelete = await Book.find({ module: 'sales', code: { $in: ['9\\', 'v'] } });
    console.log('Found books to delete:', booksToDelete);
    
    for (const book of booksToDelete) {
      await Book.deleteOne({ _id: book._id });
      console.log(`Deleted book: ${book.name} (${book.code})`);
    }
    
    // Also delete any "GREY PURCHASE" in sales module
    const wrongPurchases = await Book.find({ module: 'sales', name: 'GREY PURCHASE' });
    for (const book of wrongPurchases) {
      await Book.deleteOne({ _id: book._id });
      console.log(`Deleted wrong purchase book: ${book.name} (${book.code})`);
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixBooks();
