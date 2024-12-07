const Settings = require('../models/setttings');
const DEFAULT_ID = '6753c14766a802085fe1497d';

const closeGifts = async (req, res) => {
	try {
		const savedSettings = await Settings.findOneAndUpdate(
			{ _id: DEFAULT_ID },
			{ $set: { closeGifts: req.body.closeGifts } },
			{ new: true, upsert: true }
		);
		res.status(201).json(savedSettings);
	} catch (error) {
		res.status(400).json({ message: error.message });
	}
};

const getSettings = async (req, res) => {
	try {
		const settings = await Settings.findById(DEFAULT_ID);

		if (!settings) {
			return res.status(404).json({ message: 'Settings not found' });
		}

		res.status(200).json(settings.closeGifts);
	} catch (error) {
		res.status(500).json({ message: 'An error occured!' });
	}
};

module.exports = {
	closeGifts,
	getSettings,
};
