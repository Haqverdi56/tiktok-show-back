const express = require('express');
const addGift = require('../controllers/addGiftController');
const router = new express.Router();

router.get('/', addGift.getGiftUrl);

module.exports = router;