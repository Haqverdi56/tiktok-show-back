const express = require('express');
const router = new express.Router();
const settingController = require('../controllers/settingsController')

router.post('/', settingController.closeGifts);
router.get('/', settingController.getSettings);

module.exports = router;
