const Participant = require('../models/Participant');

// Yeni bir katılımcı ekle
exports.addParticipant = async (req, res) => {
	const { name, giftId, score, img, gifts } = req.body;
	const newParticipant = new Participant({ name, giftId, score, img, gifts });
	try {
		await newParticipant.save();
		res.status(201).send(newParticipant);
	} catch (error) {
		res.status(400).send(error);
	}
};

// Tüm katılımcıları al
exports.getAllParticipants = async (req, res) => {
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
		res.status(400).send("zart",error);
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
