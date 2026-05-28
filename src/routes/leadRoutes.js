const express = require('express');
const router = express.Router();
const c = require('../controllers/leadController');

// ⚠️  IMPORTANT: /bulk routes MUST come before /:id routes.
// Express matches routes top-to-bottom; if /:id came first,
// "bulk" would be treated as an ID and fail with a 404.

router.post('/bulk', c.bulkCreate);
router.put('/bulk', c.bulkUpdate);

router.post('/', c.create);
router.get('/', c.list);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.patch('/:id/status', c.updateStatus);

module.exports = router;
