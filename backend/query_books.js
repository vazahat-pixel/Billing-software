const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const queryBooks = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        const db = mongoose.connection.db;
        const books = await db.collection('books').find({}).toArray();
        console.log('BOOKS_START');
        console.log(JSON.stringify(books, null, 2));
        console.log('BOOKS_END');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

queryBooks();
