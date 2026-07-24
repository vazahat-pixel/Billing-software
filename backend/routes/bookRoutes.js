const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { requirePermission } = require('../middlewares/permission.middleware');

const read = requirePermission('masters', 'read');
const write = requirePermission('masters', 'create');
const del = requirePermission('masters', 'delete');

router.get('/module/:module', read, bookController.getBooksByModule);
router.get('/', read, bookController.getAllBooks);
router.post('/', write, bookController.createBook);
router.put('/:id', write, bookController.updateBook);
router.delete('/:id', del, bookController.deleteBook);

module.exports = router;
