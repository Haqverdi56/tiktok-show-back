const express = require('express');
const likersController = require('../controllers/likersController');
const router = new express.Router();

router.get('/', likersController.getAllLikers);
// router.delete('/participants/:id', likersController.deleteParticipant);

module.exports = router;
