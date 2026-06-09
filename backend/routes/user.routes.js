const express = require('express');
const router = express.Router();
const { listUsers, createUser, updateUser, deactivateUser } = require('../controllers/user.controller');

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deactivateUser);

module.exports = router;
