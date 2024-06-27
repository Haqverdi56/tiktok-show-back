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
const tiktokUsername = 'tt.shov';

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
app.use('/', function(req, res) {
    res.send("Welcome to my API")
});


// MongoDB bağlantısı
mongoose
	.connect(process.env.SECRET_KEY)
	.then(() => console.log('MongoDB bağlantısı başarılı'))
	.catch((err) => console.error('MongoDB bağlantısı hatası', err));

// Routes
// app.use(participantRoutes);
app.use('/api', participantRoutes);

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

app.post('/api/disconnect', (req, res) => {
	tiktokLiveConnection
		.on('disconnected', (actionId)=> {
			console.log(actionId);
			console.log("disconnect");
		})
		.then((resp) => console.log(resp))
		.catch((err) =>
			res.status(500).send('TikTok canlı bağlantısı kapatılamadı')
		);
});

// Hediye olaylarını dinle ve tarayıcıya gönder

let total = 0;
tiktokLiveConnection.on('gift', async (data) => {
	if (data.giftType === 1 && !data.repeatEnd) {
		// console.log(
		// 	`${data.uniqueId} is sending gift ${data.giftName} x${data.repeatCount}`
		// );
	} else {
		io.emit('gift', data); // Tüm bağlı istemcilere gönder

		// Streak ended or non-streakable gift => process the gift with final repeat_count
		console.log(
			`${data.uniqueId} has sent gift ${data.giftName} count:${data.diamondCount} x${data.repeatCount} giftID: ${data.giftId}`
		);
		if (data.displayType != 'live_gift_send_message_to_guest') {
			const participant = await Participant.findOne({ giftId: data.giftId });

			if (participant) {
				const response = await axios.patch(
					`http://localhost:3000/api/participants/${participant._id}`,
					{
						score: data.diamondCount * data.repeatCount,
					}
				);

				console.log(
					'Score updated:',
					response.data.score,
					' name:',
					response.data.name
				);
			}
			console.log(
				'Guest false',
				(total += data.diamondCount * data.repeatCount)
			);
		} else {
			console.log('Guest true');
		}
	}
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
