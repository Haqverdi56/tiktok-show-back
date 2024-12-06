const GiftUrl = require('../models/addGift');

exports.getGiftUrl = async (req, res) => {
	try {
		const data = await GiftUrl.find();
		res.json(data);
	} catch (error) {
		console.error('Error 98:', error);
	}
};
