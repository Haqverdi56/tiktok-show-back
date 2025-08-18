// controllers/countdownController.js
const Countdown = require('../models/Countdown');

// Admin paneldən dəyəri POST etmək (dəqiqə → saniyə)
const setCountdown = async (req, res) => {
    console.log(req.body);
    
	try {
		const { minutes } = req.body;
		const seconds = minutes * 60;

		let countdown = await Countdown.findOne();
		if (!countdown) {
			countdown = new Countdown({ seconds });
		} else {
			countdown.seconds = seconds;
		}

		await countdown.save();
		res.status(200).json({ success: true, countdown });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

// Monitor üçün dəyəri GET etmək
const getCountdown = async (req, res) => {
	try {
		const countdown = await Countdown.findOne();
		if (!countdown) return res.status(404).json({ success: false, message: 'Countdown not set' });

		res.status(200).json({ success: true, countdown });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
};

module.exports = { setCountdown, getCountdown };
