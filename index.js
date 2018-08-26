require('dotenv').config();

const util = require('util');
const http = require('http');

const Twit = require('twit');
const socketio = require("socket.io");
const moment = require('moment');

var T = new Twit({
	consumer_key: process.env.API_KEY,
	consumer_secret: process.env.API_SECRET,
	access_token: process.env.OAUTH_ACCESS_TOKEN,
	access_token_secret: process.env.OAUTH_SECRET
});

const server = http.createServer();
const io = socketio(server, { serveClient: false });

var last_highest_tweet = null;

fetchNewTweets();

server.listen(process.env.HTTP_PORT, process.env.HTTP_ADDRESS, () => {
	let addr = server.address();
	util.log(`socket.io server is listening on ${addr.address}:${addr.port}`);
});

io.on("connection", function(socket) {
	var socket_ip = socket.handshake.headers["x-real-ip"]; //added by nginx reverse proxy

	if (socket.handshake.query.code != process.env.AUTH_CODE) {
		util.log(`Incoming socket did not authenticate with a valid code (ip: ${socket_ip})`);
		socket.disconnect(true);
	} else {
		util.log(`New socket authenticated successfully (ip: ${socket_ip})`);
	}

	io.to("statuschannel").emit("status", {
		title: "New client connected",
		text: `From IP ${socket_ip}`
	});

	socket.join("statuschannel");
});

function fetchNewTweets() {
	T.get("statuses/home_timeline", (last_highest_tweet != null) ? { since_id: last_highest_tweet } : undefined, function(err, data, resp) {
		let now = moment();
		let ratelimit_remaining = resp.headers["x-rate-limit-remaining"];
		let ratelimit_reset = resp.headers["x-rate-limit-reset"];
		var delay_ms = 60000;

		if (ratelimit_remaining != undefined && ratelimit_reset != undefined) {
			let remaining = new Number(ratelimit_remaining);
			let reset_date = moment.unix(ratelimit_reset);

			if (remaining == 0) {
				util.log(`Rate Limit exceeded. Trying again ${reset_date.fromNow()} (${reset_date.diff(now)}ms)`);

				setTimeout(() => { fetchNewTweets() }, reset_date.diff(now));
			} else {
				let next_reset = reset_date.diff(now);
				delay_ms = Math.max(Math.ceil(next_reset / remaining), 20000);

				util.log(`Set next request delay to ${delay_ms}`);
			}
		}

		if (err) {
			util.log(`Error while fetching timeline: ${err.message}`);
			return setTimeout(() => { fetchNewTweets() }, delay_ms);
		}
		if (data.length == 0) return setTimeout(() => { fetchNewTweets() }, delay_ms);

		let new_tweets = [];

		//collect all new tweets in one array
		for(let i in data) {
			if (data[i].id == last_highest_tweet) break;

			let created_at = moment(data[i].created_at, 'dd MMM DD HH:mm:ss ZZ YYYY', 'en');

			if (now.diff(created_at) > delay_ms) break; //delay_ms is not technically correct, since it is the current delay, not the delay of the last request, but w/e

			new_tweets.push({
				text: data[i].text,
				created_at,
				user: {
					name: data[i].user.name,
					screen_name: data[i].user.screen_name,
					profile_image_url: data[i].user.profile_image_url,
				}
			});

		}

		last_highest_tweet = data[0].id;

		if (new_tweets.length > 0) {
			util.log(`Fetched ${new_tweets.length} new tweets`);

			//loop through the array and schedule the sending of the tweets with their realtime distance in mind
			//so we don't send out a huge batch of tweets once per minute

			var last_tweet_time = new_tweets[new_tweets.length - 1].created_at.clone();

			for(let i = new_tweets.length - 1; i >= 0; i--) {
				setTimeout(() => {
					new_tweets[i].created_at = new_tweets[i].created_at.valueOf();
					io.emit("tweet", new_tweets[i]);

					//console.log("emit tweet", new_tweets[i]);
				}, new_tweets[i].created_at.diff(last_tweet_time));

				last_tweet_time = new_tweets[i].created_at.clone();
			}
		}

		return setTimeout(() => { fetchNewTweets() }, delay_ms);
	});
}