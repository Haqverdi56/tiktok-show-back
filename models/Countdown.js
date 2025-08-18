// models/Countdown.js
const mongoose = require('mongoose');

const CountdownSchema = new mongoose.Schema(
	{
		seconds: { type: Number, default: 600 }, // default 10 dəqiqə
	},
	{ timestamps: true }
);

module.exports = mongoose.models.Countdown || mongoose.model('Countdown', CountdownSchema);
