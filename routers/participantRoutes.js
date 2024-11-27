const express = require('express');
const participantController = require('../controllers/participantController');
const router = new express.Router();

router.get('/participants', participantController.getAllParticipants);
router.post('/participants', participantController.addParticipant);
router.post('/scorex', participantController.scoreX);
router.patch('/participants/:id', participantController.updateParticipant);
router.delete('/participants/:id', participantController.deleteParticipant);

router.post('/duel-deactive', participantController.duelDeactive);
router.patch('/reset-scores', participantController.resetScore);
router.patch('/set-duel', participantController.duelActive);
router.patch('/participants-change/:id', participantController.changeActiveParticipant);

module.exports = router;
