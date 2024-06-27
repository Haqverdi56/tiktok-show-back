const express = require('express');
const participantController = require('../controllers/participantController');
const router = new express.Router();

router.get('/participants', participantController.getAllParticipants);
router.post('/participants', participantController.addParticipant);
router.patch('/participants/:id', participantController.updateParticipant);
router.delete('/participants/:id', participantController.deleteParticipant);

module.exports = router;
