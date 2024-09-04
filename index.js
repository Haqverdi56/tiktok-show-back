const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cors = require('cors');
const participantRoutes = require('./routers/participantRoutes');
const axios = require('axios');
const Participant = require('./models/Participant');

require('dotenv').config();

const tiktokUsername = 'shans.show';

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
// app.use(express.json());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// MongoDB bağlantısı
mongoose
	.connect(process.env.SECRET_KEY)
	.then(() => console.log('MongoDB bağlantısı başarılı'))
	.catch((err) => console.error('MongoDB bağlantısı hatası', err));

// Routes
let liveStop = false;
let reconnectTimeout;

app.post('/api/disconnect', (req, res) => {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout); // Clear any pending reconnection attempt
	}
	try {
		tiktokLiveConnection.disconnect();
		res.status(200).send('Disconnect!');
		console.log('diconnect!');
		liveStop = true;
	} catch (err) {
		console.error('Error:', err);
		res.status(500).send('Error disconnecting');
	}
});

app.post('/api/connect', (req, res) => {
	tiktokLiveConnection
		.connect()
		.then((state) => {
			console.info(`Oda Kimliği ${state.roomId} ile bağlandı`);
			// res.send(state.isConnected);
			liveStop = false;
		})
		.catch((err) => {
			console.error('Bağlantı başarısız', err);
			// res.send(err);
		});
});

tiktokLiveConnection.on('error', (err) => {
	console.error('Error!', err);
});

tiktokLiveConnection.on('disconnected', () => {
	console.log('Bağlantı kesildi!!!');
	reconnectTimeout = setTimeout(async () => {
		if (!liveStop) {
			try {
				console.log('Yeniden bağlanmayı deniyor...');
				await tiktokLiveConnection.connect();
				console.log('Yeniden bağlandı!');
			} catch (err) {
				console.error('Yeniden bağlantı başarısız:', err);
			}
		} else {
			console.log('Live has stopped');
			liveStop = false;
		}
	}, 1000);
});

// Socket.IO bağlantılarını dinle
io.on('connection', (socket) => {
	// console.log('Tarayıcı bağlandı');
	socket.on('message', (message) => {
		console.log('Tarayıcıdan gelen mesaj:', message);
	});
});

// Hediye olaylarını dinle ve tarayıcıya gönder

const MAX_RETRY_COUNT = 15; // Maksimum yeniden deneme sayısı

async function updateParticipantScore(giftId, increment) {
	for (let attempt = 0; attempt < MAX_RETRY_COUNT; attempt++) {
		const session = await mongoose.startSession();
		session.startTransaction();
		try {
			const participant = await Participant.findOneAndUpdate(
				{ name: 'Nabat' },
				{ $inc: { score: increment } },
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
				console.log('İçtirakçı tapılmadı:', giftId);
			}

			await session.commitTransaction();
			session.endSession();
			return; // Başarılı, fonksiyondan çık
		} catch (error) {
			await session.abortTransaction();
			session.endSession();
			if (attempt === MAX_RETRY_COUNT - 1) {
				console.error(
					'Error updating participant score after multiple attempts:'
				);
				// throw error; // Maksimum deneme sayısına ulaşıldı, hatayı tekrar fırlat
			}
			console.warn(
				`Retrying update for participant score, attempt ${attempt + 1}`
			);
		}
	}
}

tiktokLiveConnection.on('gift', async (data) => {
	if (data.giftType === 1 && !data.repeatEnd) {
		// Skip temporary gifts
	} else {
		io.emit('gift', data); // Tüm bağlı istemcilere gönder
		console.log(
			`${data.nickname} has sent gift ${data.giftName} count:${data.diamondCount} x${data.repeatCount} giftID: ${data.giftId}`
		);

		if (data.displayType != 'live_gift_send_message_to_guest') {
			const increment = data.diamondCount * data.repeatCount;
			try {
				await updateParticipantScore(data.giftId, increment);
			} catch (error) {
				console.error('Failed to update participant score:', error);
			}
		} else {
			console.log('Guest true');
		}
	}
});

app.use('/api', participantRoutes);
app.use('/', function (req, res) {
	res.send('Welcome to my API');
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
