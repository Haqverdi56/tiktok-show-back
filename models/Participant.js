const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
	name: { type: String, required: true },
	isActive:  { type: Boolean, required: true },
	giftId: { type: [Number], required: true },
	score: { type: Number, default: 0 },
	img: { type: String, required: true },
	gifts: { type: [String], required: true },
});

const Participant = mongoose.model('Participant', participantSchema);

module.exports = Participant;
