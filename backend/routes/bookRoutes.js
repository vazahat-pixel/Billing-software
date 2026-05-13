const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

router.get('/module/:module', bookController.getBooksByModule);
router.post('/', bookController.createBook);
router.delete('/:id', bookController.deleteBook);

module.exports = router;
