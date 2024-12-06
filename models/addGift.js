const mongoose = require('mongoose');

const giftUrlSchema = new mongoose.Schema({
	name: { type: String, required: true },
	id: { type: [Number], required: true },
	url_list: { type: [String], required: true },
	diamond_count: { type: [Number], required: true },
});

const GiftUrl = mongoose.model('GiftUrl', giftUrlSchema);

module.exports = GiftUrl;