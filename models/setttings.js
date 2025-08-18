const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
	closeGifts: { type: Boolean, required: true, default: false },
	diamondAllDay: { type: Number, default: 0 },
});

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
