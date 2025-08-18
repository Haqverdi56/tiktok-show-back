// routes/countdownRoutes.js
const express = require('express');
const { setCountdown, getCountdown } = require('../controllers/countdownController');

const router = express.Router();

router.post('/set', setCountdown); // admin paneldən POST
router.get('/get', getCountdown); // monitor üçün GET

module.exports = router;
