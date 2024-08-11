const Participant = require('../models/Participant');

// Yeni bir katılımcı ekle
exports.resetScore = async (req, res) => {
	console.log('reset!!!');
	try {
		await Participant.updateMany({}, { $set: { score: 0 } });
		await Participant.updateMany({}, { $set: { duel: 0 } });
		
		res.status(200).send({ message: 'All scores have been reset to 0' });
	} catch (error) {
		console.error('Error resetting scores:', error);
		res.status(500).send({ message: 'Failed to reset scores' });
	}
};
exports.scoreX = async (req, res) => {
	try {
		const { scoreX } = req.body;
	
		const result = await Participant.updateMany(
			{},
		  { scoreX: scoreX },
		  { upsert: false, multi: true }
		);
	
		res.json({ success: true, data: result });
	  } catch (error) {
		res.status(500).json({ success: false, error: error.message });
	  }
};
exports.duelActive = async (req, res) => {
	console.log('reset!!!');
	const { ids } = req.body;

	if (!Array.isArray(ids) || ids.length !== 3) {
		return res
			.status(400)
			.send({ message: 'Exactly three IDs must be provided' });
	}

	try {
		// Tüm katılımcıların duel alanını 0 olarak ayarla
		await Participant.updateMany({}, { $set: { duel: 0 } });

		// İlk elemanı 1, ikincisini 2 ve üçüncüsünü 3 olarak ayarla
		await Participant.updateOne({ _id: ids[0] }, { $set: { duel: 1 }, $addToSet: { giftId: { $each: [6646, 8916, 6369] } } });
        await Participant.updateOne({ _id: ids[1] }, { $set: { duel: 2 }, $addToSet: { giftId: { $each: [8469, 6149, 9072] } } });
        await Participant.updateOne({ _id: ids[2] }, { $set: { duel: 3 }, $addToSet: { giftId: { $each: [5767, 6203, 8563] } } });

		res.status(200).send({ message: 'Participants updated successfully' });
	} catch (error) {
		console.error('Error updating participants:', error);
		res.status(500).send({ message: 'Failed to update participants' });
	}
};

exports.addParticipant = async (req, res) => {
	const { name, isActive, giftId, score, img, gifts, duel } = req.body;
	const newParticipant = new Participant({ name, isActive, giftId, score, img, gifts, duel });
	try {
		console.log("Succc")
		await newParticipant.save();
		res.status(201).send(newParticipant);
	} catch (error) {
		console.log("Errr");
		res.status(400).send(error);
	}
};

// Tüm katılımcıları al
exports.getAllParticipants = async (req, res) => {
	// console.log("path:",req.path, "query:", req.query)
	try {
		const participants = await Participant.find();
		res.status(200).send(participants);
	} catch (error) {
		res.status(500).send(error);
	}
};

// Belirli bir katılımcıyı güncelle
exports.updateParticipant = async (req, res) => {
	const updates = Object.keys(req.body);
	const allowedUpdates = ['name', 'giftId', 'score', 'img', 'gifts'];
	const isValidOperation = updates.every((update) =>
		allowedUpdates.includes(update)
	);

	if (!isValidOperation) {
		return res.status(400).send({ error: 'Geçersiz güncelleme alanları' });
	}

	const participantId = req.params.id;

	try {
		const participant = await Participant.findById(participantId);

		if (!participant) {
			return res.status(404).send();
		}

		const { score } = req.body;

		const newScore = participant.score + Number(score);

		const updatedParticipant = await Participant.findByIdAndUpdate(
			participantId,
			{ score: newScore },
			{ new: true } // Güncellenmiş veriyi döndürmek için
		);

		res.json(updatedParticipant);

		// updates.forEach((update) => (participant[update] = req.body[update]));
		// await participant.save();
		// res.send(participant);
	} catch (error) {
		res.status(400).send('zart', error);
	}
};

// Belirli bir katılımcıyı sil
exports.deleteParticipant = async (req, res) => {
	try {
		const participant = await Participant.findByIdAndDelete(req.params.id);

		if (!participant) {
			return res.status(404).send();
		}

		res.send(participant);
	} catch (error) {
		res.status(500).send(error);
	}
};
