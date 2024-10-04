const mongoose = require('mongoose');

const likerSchema = new mongoose.Schema(
	{
		uniqueId: { type: String, required: true, unique: true }, // TikTok kullanıcısının benzersiz kimliği
		totalLikes: { type: Number, default: 0 }, // Toplam beğeni sayısı
		nickname: { type: String },
		profilePictureUrl: { type: String },
	},	
	{ timestamps: true }
);

const Likers = mongoose.model('Likers', likerSchema);

module.exports = Likers;
