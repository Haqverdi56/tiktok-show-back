const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const uploadMiddleware = multer({
	limits: {
		fileSize: 1024 * 1024 * 20,
	},
	fileFilter: (req, file, cb) => {
		cb(undefined, true);
	},
	storage: multer.diskStorage({
		filename: (req, file, cb) => {
			cb(null, file.originalname);
		},
		destination: (req, file, cb) => {
			cb(null, 'uploads/');
		},
	}),
});
const cors = require('cors');
const participantRoutes = require('./routers/participantRoutes');
const likersRoutes = require('./routers/likersRoutes');
const { handleLike } = require('./controllers/likersController');
const Participant = require('./models/Participant');

require('dotenv').config();

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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
// MongoDB bağlantısı
mongoose
	.connect(process.env.SECRET_KEY)
	.then(() => console.log('MongoDB bağlantısı başarılı'))
	.catch((err) => console.error('MongoDB bağlantısı hatası', err));

// Routes
let liveStop = false;
let reconnectTimeout;
let liveIsConnected = false;

app.post('/api/disconnect', (req, res) => {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout); // Clear any pending reconnection attempt
	}
	try {
		tiktokLiveConnection.disconnect();
		res.status(200).send('Disconnect!');
		console.log('disconnect!');
		liveStop = true;
		liveIsConnected = false;
	} catch (err) {
		console.error('Error:', err);
		res.status(500).send('Error disconnecting');
		liveIsConnected = true;
	}
});

let tiktokLiveConnection = null;

const connectToLiveStream = async (username) => {
	tiktokLiveConnection = new WebcastPushConnection(username);

	const MAX_RETRY_COUNT = 15;

	async function updateParticipantScore(giftId, increment) {
		for (let attempt = 0; attempt < MAX_RETRY_COUNT; attempt++) {
			const session = await mongoose.startSession();
			session.startTransaction();
			try {
				const participant = await Participant.findOneAndUpdate(
					{ giftId: giftId },
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

	tiktokLiveConnection.on('error', (err) => {
		console.error('Error 56!', err);
		io.emit('disconnectLive', false);
	});

	tiktokLiveConnection.on('disconnected', () => {
		console.log('Bağlantı kesildi!!!');
		io.emit('disconnectLive', false);
		reconnectTimeout = setTimeout(async () => {
			if (!liveStop) {
				try {
					console.log('Yeniden bağlanmayı deniyor...');
					await tiktokLiveConnection.connect();
					console.log('Yeniden bağlandı!');
					liveIsConnected = true;
					io.emit('disconnectLive', true);
				} catch (err) {
					console.error('Yeniden bağlantı başarısız:', err);
					liveIsConnected = false;
					io.emit('disconnectLive', false);
				}
			} else {
				console.log('Live has stopped');
				liveStop = false;
				io.emit('disconnectLive', false);
			}
		}, 1000);
	});

	tiktokLiveConnection.on('gift', async (data) => {
		if (data.giftType === 1 && !data.repeatEnd) {
			// Skip temporary gifts
		} else {
			io.emit('gift', data); // Tüm bağlı istemcilere gönder
			console.log(
				`${data.nickname} has sent gift ${data.giftName} count:${data.diamondCount} x${data.repeatCount} giftID: ${data.giftId}`
			);
			// console.log(data);

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

	// tiktokLiveConnection.on('like', async (data) => {
	// 	await handleLike(data);
	// });

	tiktokLiveConnection
		.connect()
		.then((state) => {
			console.info(`Oda Kimliği ${state.roomId} ile bağlandı`);
			// res.send(state.isConnected);
			io.emit('connectStatus', true);
			io.emit('disconnectLive', true);
			liveStop = false;
			liveIsConnected = true;
		})
		.catch((err) => {
			console.error('Bağlantı başarısız', err);
			// res.send(err);
			liveIsConnected = false;
		});
};

app.post('/api/connect', async (req, res) => {
	let tiktokUsername = req.body.pageName;
	await connectToLiveStream(tiktokUsername);
});

// Socket.IO bağlantılarını dinle
io.on('connection', (socket) => {
	// console.log('Tarayıcı bağlandı');
	socket.on('message', (message) => {
		console.log('Tarayıcıdan gelen mesaj:', message);
	});
});

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/view/index.html');
});
app.post('/participants', uploadMiddleware.single('img'), async (req, res) => {
	console.log(req.body);
	try {
		const { name, isActive, giftId, gifts, duel, scoreX } = req.body;

		// Resim dosyasının yolu
		const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
		// Katılımcıyı kaydet
		const newParticipant = new Participant({
			name,
			isActive: JSON.parse(isActive),
			giftId: JSON.parse(giftId), // JSON string olarak gönderilen veriyi parse ediyoruz
			gifts: JSON.parse(gifts),
			duel: parseInt(duel),
			scoreX: JSON.parse(scoreX),
			img: imagePath,
		});

		await newParticipant.save();

		res
			.status(201)
			.json({
				message: 'Katılımcı başarıyla eklendi!',
				participant: newParticipant,
			});
	} catch (error) {
		console.error('Hata oluştu:', error);
		res.status(500).json({ message: 'Katılımcı eklenirken bir hata oluştu.' });
	}
});
// app.post('/upload', uploadMiddleware.single('avatar'), function (req, res) {
// 	if (!req.file) {
// 		return res.json({
// 			success: false,
// 			message: 'Dosya yuklenemedi',
// 		});
// 	}
// 	// return succes
// 	return res.json({
// 		success: true,
// 		message: 'Dosya yuklendi. Tebrikler...',
// 		file: req.file,
// 	});
// });
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
	console.log('Uploads klasörü oluşturuldu.');
}
app.get('/uploads/:filename', function (req, res) {
	var filename = req.params.filename;
	res.sendFile(__dirname + '/uploads/' + filename);
});
// available gifts
app.get('/availablegifts', (req, res) => {
	let tiktokLiveConnectionName = new WebcastPushConnection('mr_developerh');
	tiktokLiveConnectionName
		.getAvailableGifts()
		.then((giftList) => {
			// console.log(giftList);
			// giftList.forEach(gift => {
			// 	console.log(`id: ${gift.id}, name: ${gift.name}, cost: ${gift.diamond_count}`)
			// });
			res.status(200).json(giftList);
		})
		.catch((err) => {
			console.error(err);
		});
});
app.use('/api', participantRoutes);
app.use('/api/showlikers', likersRoutes);
app.post('/api/connection-status', (req, res) => {
	liveIsConnected ? res.send(true) : res.send(false);
});
app.use('/', function (req, res) {
	res.send('Welcome to my API');
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});