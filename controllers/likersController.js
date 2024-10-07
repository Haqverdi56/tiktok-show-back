const Likers = require('../models/Likers');

// Beğenileri işleyip toplamayı yapan fonksiyon
const handleLike = async (data) => {
	try {
		const liker = await Likers.findOneAndUpdate(
			{ uniqueId: data.uniqueId }, // Benzersiz kimliğe göre arama
			{
				$setOnInsert: {
					uniqueId: data.uniqueId,
					nickname: data.nickname,
					profilePictureUrl: data.profilePictureUrl,
				},
				$inc: { totalLikes: data.likeCount }, // Toplam beğeniyi arttırma
			},
			{ upsert: true, new: true } // Belge yoksa ekleme, varsa güncelleme
		);
	} catch (error) {
		console.error('Error handling like:', error);
	}
};

const getAllLikers = async (req, res) => {
	try {
		const likers = await Likers.find();

		if (!likers.length) {
			return res
				.status(404)
				.json({ message: 'Henüz beğeni gönderen kullanıcı yok.' });
		}

		res.status(200).json(likers);
	} catch (error) {
		console.error('Error fetching likers:', error);
		res.status(500).json({ message: 'Likers alınırken bir hata oluştu.' });
	}
};

const deleteAllLikers = async (req, res) => {
	try {
		await Likers.deleteMany({}); // Tüm dokümanları sil
		res
			.status(200)
			.json({ message: 'All likers have been deleted successfully.' });
	} catch (error) {
		res.status(500).json({
			error: 'An error occurred while deleting likers.',
			details: error,
		});
	}
};

module.exports = {
	handleLike,
	getAllLikers,
	deleteAllLikers,
};
