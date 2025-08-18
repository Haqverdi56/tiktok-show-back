const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });
const fs = require('fs');
const cors = require('cors');
const participantRoutes = require('./routers/participantRoutes');
const settingsRouter = require('./routers/settingsRouter');
const addGiftUrl = require('./routers/addGiftRouter');
const likersRoutes = require('./routers/likersRoutes');
const countdownRoutes = require('./routers/countdownRoutes');

const { handleLike } = require('./controllers/likersController');

const GiftUrl = require('./models/addGift');
const Participant = require('./models/Participant');
const AWS = require('aws-sdk');

var request = require('request');
const Countdown = require('./models/Countdown');
const Settings = require('./models/setttings');

// AWS S3 ayarları
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

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
	}
});

let tiktokLiveConnection = null;
const sessionId = '29431c5c202de06d5cbe664134adf232';

const connectToLiveStream = async (username) => {
	tiktokLiveConnection = new WebcastPushConnection(username, { sessionId });

	const MAX_RETRY_COUNT = 15;

	async function updateParticipantScore(giftId, increment) {
		for (let attempt = 0; attempt < MAX_RETRY_COUNT; attempt++) {
			const session = await mongoose.startSession();
			session.startTransaction();
			try {
				const participant = await Participant.updateMany({ giftId: giftId }, { $inc: { score: increment } }, { new: true, session: session });
				const logParticipants = await Participant.find({ giftId: giftId }, null);
				if (logParticipants.length > 0) {
					logParticipants.forEach((participant) => {
						console.log(`Score updated: ${participant.score}  name: ${participant.name}`);
					});
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
					console.error('Error updating participant score after multiple attempts:');
					// throw error; // Maksimum deneme sayısına ulaşıldı, hatayı tekrar fırlat
				}
				console.warn(`Retrying update for participant score, attempt ${attempt + 1}`);
			}
		}
	}

	tiktokLiveConnection.on('error', (err) => {
		console.error('Error 56!', err);
		io.emit('disconnectLive', false);
		liveIsConnected = false;
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
				liveIsConnected = false;
				io.emit('disconnectLive', false);
			}
		}, 1000);
	});

	tiktokLiveConnection.on('gift', async (data) => {
		if (data.giftType === 1 && !data.repeatEnd) {
			// Skip temporary gifts
		} else {
			io.emit('gift', data);
			console.log(`${data.nickname} has sent gift ${data.giftName} count:${data.diamondCount} x${data.repeatCount} giftID: ${data.giftId}`);
			// console.log(data);
			const increment = data.diamondCount * data.repeatCount;
			await Settings.findOneAndUpdate(
				{}, // defaultda ilk sənədi götür
				{ $inc: { diamondAllDay: increment } }, // artırırıq
				{ new: true, upsert: true } // sənəd yoxdursa yaratsın
			);

			if (data.giftId == 6834) {
				console.log(data);
			}

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
			console.info(`RoomId connected with ${state.roomId}`);
			// res.send(state.isConnected);
			io.emit('connectStatus', true);
			io.emit('disconnectLive', true);
			liveStop = false;
			liveIsConnected = true;
		})
		.catch((err) => {
			console.error('Bağlantı başarısızzz', err);
			// res.send(err);
			liveIsConnected = false;
		});
};

// var headers = {
// 	accept: '*/*',
// 	'accept-language': 'tr,en-GB;q=0.9,en;q=0.8,az;q=0.7,ru;q=0.6',
// 	cookie:
// 		'tt_csrf_token=KwmNXZ04-ij1pD6PM5-1cMaH8Pdu-YXdPkHk; tt_chain_token=sg77WDvCeqob9k1SGsdi8w==; csrf_session_id=1ef5e7b788b71ce54b927fff596d9126; s_v_web_id=verify_lylsddx7_AN9agkcV_5jik_4alu_AXgm_z8V76t3UA5U3; uid_tt=7ffb50989e6746505711274f390e13c9f2a8a739c3ec24eaee2630e8ddf72963; uid_tt_ss=7ffb50989e6746505711274f390e13c9f2a8a739c3ec24eaee2630e8ddf72963; sid_tt=c3993d3328df18785dac1c8a9868bfc6; sessionid=c3993d3328df18785dac1c8a9868bfc6; sessionid_ss=c3993d3328df18785dac1c8a9868bfc6; store-idc=alisg; store-country-code=az; store-country-code-src=uid; tt-target-idc=alisg; tt-target-idc-sign=r-t8WRxBMMWhWrP_DiREi05nRehb-qQ2JuI5sGIL4tZhumcLW17iiO4A8JsIuXMM3qT94lXdFeshU0RB04WHiuLC-B5nG1_356ziSW4f6uBRTKbAzbt9mx31Vn9JPdS-fodJLga0uPTBBiLWIC3oMh6az8IJQs5uXYDI9gRyEtjw6VsXQGMBKmHqILQYkVC_qle8_y7bGy3RGANUkSIIuqH8U6P5ptylSYyXvFhpxjJ5zq7S9UGtt7Zbz7d09jRjimMryzpG8C8RrSltFx37B5_As_pdZVOsoaPM3ttKXq-KXXInxXPxf6Kgt6YFpmZDbAR1k1Hv6FP6u1qISH5p6kWzuPTyWleU4JBXwOGUR5aINTRG6usZKFNwsENb2cxcFaaohvahgRruBC-1B0Eb08UF0Ty6xSxkbS3KRoHpV64cxdsmNiwVvBZFj_V_jw2T16Lj6YFggE3_9zT6wggKxLm6jo6SXCEbsUa9mo2MkrvmM0v-2nJ2YyAgigZxSnZh; tta_attr_id_mirror=0.1721868807.7395370212758913041; sid_guard=c3993d3328df18785dac1c8a9868bfc6%7C1727543368%7C15552000%7CThu%2C+27-Mar-2025+17%3A09%3A28+GMT; sid_ucp_v1=1.0.0-KDdmZDIyMmM3ZjdmNmQ0NWU1OWFhOTRmMjQ1MDFiODg3NjAwMTVhYmIKIQiBiMTQhePy5mIQyPDgtwYYswsgDDDAlreWBjgIQBJIBBADGgJteSIgYzM5OTNkMzMyOGRmMTg3ODVkYWMxYzhhOTg2OGJmYzY; ssid_ucp_v1=1.0.0-KDdmZDIyMmM3ZjdmNmQ0NWU1OWFhOTRmMjQ1MDFiODg3NjAwMTVhYmIKIQiBiMTQhePy5mIQyPDgtwYYswsgDDDAlreWBjgIQBJIBBADGgJteSIgYzM5OTNkMzMyOGRmMTg3ODVkYWMxYzhhOTg2OGJmYzY; passport_csrf_token=f906f4042b792470a1e76bb4730f8191; passport_csrf_token_default=f906f4042b792470a1e76bb4730f8191; ak_bmsc=E24C47F09CF9601AA0BC609E9BE8EF3F~000000000000000000000000000000~YAAQJBkZ2WTH90mTAQAAd19RjhlAuUl+o0C24UOFok3P8+GryxPk1FIVa4i4Ad9I5BacUQ4Y6T27y75p4NXqLpNRYBmpIPTiPMmoCC6qlUQoZmw1/KXsLhuUXcBE1vsVShpz6UX/f0GHDoQoxcMBiU54HDoMPoJHrYHK7AhQhDq8vseo+6X2bOyAGVlQ7lgCFhNPqytcHJ9unKMbh1hlQwmIqs/lIWuwvivM8yPwMQzgAPq14AnMm0+3J/yNN/eOJcw8xpp/RZ5d+McCOAzD+N3SEpT4uobbLE9G2p4SvagQfPJRs613zrpjlX4KIhJodSLy7iWTt+s4pO0wN5/+nhFT9BBsTplvo4N+3cdjhJro4Y1xK60AOl47YSXMmCOPn4WCQSxkq0wATQ==; bm_sv=814B788D59C4BE2394C72B8A3B6E55EF~YAAQJRkZ2cozeWSTAQAAMs+IjhkiDoFrCm8GFezNHXJ/M8Ne+6D98M/aKT1oGXt81rLa624yMdFtXL1r+sSQI+oGjwpXnuGgi/1WCxv7jyHvcXi+mEctSZGkCvNDgtzWfIYMWc0ZPDmzGxwU80TQtVUUA32eQGOW6OZvtdc2GLP1jyXvgrppFqisQBsZqm6iXSs87GoGrp/9a4SJAbRrIB4bVQqvYgg/Lo2FCNgE03auH1G2e2Z2bTBALtBnoOOL~1; ttwid=1%7CwfXLkJLaOwzas2mHHkAJ76K2hgv9y1mld-7juWWTVNc%7C1733263158%7C692dfe805435d68edd563864e97f8249c858d8c579ee5251d167337967ea3604; odin_tt=a86209750afca3c82d47ef5611c9ef22d72fdbf764a824968d6af0afd446ba1515b6a3186aba557e13ea9d05b8056a40d72c7c0f3cfaf169a108ec474fe67f6bdae4417363fd40ff43ca534d9130f3f5; msToken=PrQGf04sTBYb2lcUkqoyqDdz49M55SXMuE2-nPS8TIXpoagnE5CiJciQlWbsIPjUPlms6s-9If4GQE8Pv2BCAopKjqMsTwJxFS3dFEZcboeQOBxjHMOqyQRiWznd4qd2IXP0yL58cMVJHA==',
// 	origin: 'https://www.tiktok.com',
// 	priority: 'u=1, i',
// 	referer: 'https://www.tiktok.com/',
// 	'sec-ch-ua':
// 		'"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
// 	'sec-ch-ua-mobile': '?0',
// 	'sec-ch-ua-platform': '"Windows"',
// 	'sec-fetch-dest': 'empty',
// 	'sec-fetch-mode': 'cors',
// 	'sec-fetch-site': 'same-site',
// 	'user-agent':
// 		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
// };

// var options = {
// 	url: 'https://webcast.tiktok.com/webcast/gift/list/?aid=1988&app_language=tr-TR&app_name=tiktok_web&browser_language=tr&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F131.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=7370421832115881478&device_platform=web_pc&focus_state=false&from_page=user&history_len=6&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=AZ&referer=https%3A%2F%2Fwww.tiktok.com%2F&region=AZ&room_id=7444277684315998983&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=864&screen_width=1536&tz_name=Asia%2FBaku&user_is_login=true&verifyFp=verify_lylsddx7_AN9agkcV_5jik_4alu_AXgm_z8V76t3UA5U3&webcast_language=tr-TR&msToken=68GKE0w6oM-cHZ50zctb_sWV6u8CU6vZQ0z5OpUSUKPWRBbj9laV71lTany0N04AHKXz82WPYH9ro_e_88UzSsbEe56vAEFAXHYuJLQc_bXXYUxjQIw9sx3HB-YpWTfENBkB5vq5zkLQ3A==&X-Bogus=DFSzswVu4rGANyvNtMmaXR6HQhYY&_signature=_02B4Z6wo000016FriBAAAIDCw8SLi69qF0-ha4yAAI8e2c',
// 	headers: headers,
// };

// async function callback(error, response, body) {
// 	if (!error && response.statusCode == 200) {
// 		// console.log(body);
// 		var obj = JSON.parse(body);
// 		// console.log(obj.data.gifts[0].image);
// 		try {
// 			for (const data of obj.data.gifts) {
// 				const existingGift = await GiftUrl.findOne({ id: data.id });

// 				if (!existingGift) {
// 					const giftData = new GiftUrl({
// 						name: data.name,
// 						id: data.id,
// 						url_list: data.image.url_list,
// 						diamond_count: data.diamond_count,
// 					});
// 					await giftData.save();
// 				}
// 			}
// 		} catch (error) {}
// 	}
// }

// request(options, callback);

app.post('/api/connect', async (req, res) => {
	let tiktokUsername = req.body.pageName;
	await connectToLiveStream(tiktokUsername);
});

let paused = false; // pause/resume üçün state

// Socket.IO bağlantılarını dinle
io.on('connection', (socket) => {
	// console.log('Tarayıcı bağlandı');
	socket.on('message', (message) => {
		console.log('Message from browser:', message);
	});

	// Pause və Resume eventləri
	socket.on('pauseCountdown', () => {
		paused = true;
	});

	socket.on('resumeCountdown', () => {
		paused = false;
	});
});

const uploadToS3 = (file) => {
	if (!file || !file.buffer) {
		throw new Error('Dosya bilgisi eksik!');
	}
	const params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: `${Date.now()}-${file.originalname}`,
		Body: file.buffer,
		ContentType: file.mimetype,
		// ACL: 'public-read',
	};

	return s3.upload(params).promise();
};
app.post('/participants', upload.single('img'), async (req, res) => {
	try {
		const { name, isActive, giftId, gifts, duel, scoreX } = req.body;

		const s3Response = await uploadToS3(req.file);
		console.log('File upload to S3:', s3Response.Location);

		// Save
		const newParticipant = new Participant({
			name,
			isActive: JSON.parse(isActive),
			giftId: JSON.parse(giftId),
			gifts: JSON.parse(gifts),
			duel: parseInt(duel),
			scoreX: JSON.parse(scoreX),
			img: s3Response.Location,
		});

		await newParticipant.save();

		res.status(201).json({
			message: 'İştirakçı əlavə edildi!',
			participant: newParticipant,
		});
	} catch (error) {
		console.error('Xəta:', error);
		res.status(500).json({ message: 'İştirakçı əlavə bir edilmədi. Xəta!' });
	}
});

app.delete('/participants/:id', async (req, res) => {
	const { id } = req.params;
	console.log(id);

	try {
		const participant = await Participant.findById(new mongoose.Types.ObjectId(id));
		if (!participant) {
			// Eğer katılımcı bulunamazsa, bir hata mesajı döndür
			console.log('İştirakçı tapılmadı!');
			return res.status(404).json({ message: 'İştirakçı tapılmadı' });
		}
		await Participant.findByIdAndDelete(id);
		const imageKey = participant.img.split('.com/')[1];

		// S3'ten fotoğrafı sil
		const params = {
			Bucket: process.env.AWS_BUCKET_NAME, // Bucket adınız
			Key: imageKey, // Silinecek dosyanın anahtarı
		};

		s3.deleteObject(params, async (err, data) => {
			if (err) {
				console.error('S3 silmə xətası:', err);
				return res.status(500).json({ message: 'Foto silinmədi!', error: err });
			}
			res.status(200).json({ message: 'Foto silindi ve güncəlləndi!' });
		});
	} catch (error) {
		res.status(500).json({ message: 'Silmə prosose zamanı xəta yarandı!' });
	}
});

// ===================
// Realtime countdown
// ===================

// Interval
setInterval(async () => {
	if (paused) return; // dayandırılıbsa, heç nə etmir

	let countdown = await Countdown.findOne();
	if (countdown && countdown.seconds > 0) {
		countdown.seconds -= 1;
		await countdown.save();
		io.emit('countdownUpdate', countdown.seconds); // frontend-ə push
	}
}, 1000);

app.use('/api/countdown', countdownRoutes);
app.use('/giftUrl', addGiftUrl);
app.use('/api', participantRoutes);
app.use('/api/showlikers', likersRoutes);
app.post('/api/connection-status', (req, res) => {
	liveIsConnected ? res.send(true) : res.send(false);
});
app.use('/settings', settingsRouter);
app.use('/', function (req, res) {
	res.send('Welcome to my API');
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
