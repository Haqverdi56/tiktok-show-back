const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cors = require('cors');
const participantRoutes = require('./routes/participantRoutes');
const axios = require('axios');
const Participant = require('./models/Participant');

require('dotenv').config();

// Canlı olan birinin kullanıcı adı
// const tiktokUsername = 'olla_lazio29';
const tiktokUsername = 'bossladygiss';

// Yeni bir bağlantı nesnesi oluştur ve kullanıcı adını geç
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

// Express uygulaması oluştur
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// MongoDB bağlantısı
mongoose
	.connect(process.env.SECRET_KEY)
	.then(() => console.log('MongoDB bağlantısı başarılı'))
	.catch((err) => console.error('MongoDB bağlantısı hatası', err));

// Routes
// app.use(participantRoutes);
app.use('/api', participantRoutes);

app.post('/api/disconnect', (req, res) => {
	tiktokLiveConnection
		.on('disconnected', (actionId) => {
			console.log(actionId);
			console.log('disconnect');
		})
		.then((resp) => console.log(resp))
		.catch((err) =>
			res.status(500).send('TikTok canlı bağlantısı kapatılamadı')
		);
});

// Socket.IO bağlantılarını dinle
io.on('connection', (socket) => {
	console.log('Tarayıcı bağlandı');
	socket.on('message', (message) => {
		console.log('Tarayıcıdan gelen mesaj:', message);
	});
});

tiktokLiveConnection
	.connect()
	.then((state) => {
		console.info(`Oda Kimliği ${state.roomId} ile bağlandı`);
	})
	.catch((err) => {
		console.error('Bağlantı başarısız', err);
	});

// Hediye olaylarını dinle ve tarayıcıya gönder

tiktokLiveConnection.on('gift', async (data) => {
	if (data.giftType === 1 && !data.repeatEnd) {
		// Skip temporary gifts
	} else {
		io.emit('gift', data); // Tüm bağlı istemcilere gönder
		console.log(
			`${data.nickname} has sent gift ${data.giftName} count:${data.diamondCount} x${data.repeatCount} giftID: ${data.giftId}`
		);

		if (data.displayType != 'live_gift_send_message_to_guest') {
			try {
				// MongoDB işlemi başlat
				const session = await mongoose.startSession();
				session.startTransaction();

				const participant = await Participant.findOneAndUpdate(
					{ giftId: data.giftId },
					{ $inc: { score: data.diamondCount * data.repeatCount } },
					{ new: true, session: session }
				);

				if (participant) {
					console.log(
						'Score updated:',
						participant.score,
						' name:',
						participant.name
					);
				} else {
					console.log('Participant not found for giftId:', data.giftId);
				}

				// İşlemi tamamla
				await session.commitTransaction();
				session.endSession();
			} catch (error) {
				console.error('Error updating participant score:', error);
			}
		} else {
			console.log('Guest true');
		}
	}
});

app.use('/', function (req, res) {
	res.send('Welcome to my API');
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
