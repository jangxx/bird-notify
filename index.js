require('dotenv').config();

const util = require('util');
const crypto = require('crypto');

const express = require('express');
const request = require('request-promise');

const twitter_oauth = {
	consumer_key: process.env.API_KEY,
	consumer_secret: process.env.API_SECRET,
	token: process.env.OAUTH_ACCESS_TOKEN,
	token_secret: process.env.OAUTH_SECRET
};

var app = express();

/**
 * SETTING UP THE REQUIRED WEBHOOK
 */
getBearerToken()
	.then((result) => {
		return getExistingWebhooks(result.token);
	})
	.then((result) => {
		util.log(`Webhook id is ${result.id}.`)
		return registerSubscriptions().then((body) => {
			console.log(body);
		});
	})
	.catch((err) => {
		util.log(`Error during webhook registration: ${err.message}`);
	});

app.get("/webhook/twitter", function(req, resp) {
	var crc_token = req.query.crc_token;

	if (!crc_token) return resp.sendStatus(400);

	let hmac = crypto.createHmac("sha256", process.env.API_SECRET).update(crc_token).digest("base64");

	util.log(`Received CRC token ${crc_token} and calculated HMAC ${hmac}`);

	resp.send({
		response_token: `sha256=${hmac}`
	});
});

app.post("/webhook/twitter", express.json(), function(req, resp) {
	console.log(req.body);
	resp.end();
});

app.listen(process.env.HTTP_PORT, process.env.HTTP_ADDRESS, () => {
	util.log(`Webhook server is listening on ${process.env.HTTP_ADDRESS}:${process.env.HTTP_PORT}`);
});

function getBearerToken() {
	let url = "https://api.twitter.com/oauth2/token";

	util.log("Retrieving Bearer token...");

	return request.post({
		url: url,
		json: true,
		headers: {
			"Authorization": `Basic ${new Buffer(`${process.env.API_KEY}:${process.env.API_SECRET}`).toString("base64")}`
		},
		qs: { grant_type: "client_credentials" }
	}).then((body) => {
		if (body.errors) throw new Error(body.errors[0].message);

		return { token: body.access_token };
	});
}

function getExistingWebhooks(token) {
	let url = `https://api.twitter.com/1.1/account_activity/all/${process.env.TWITTER_DEV_ENV}/webhooks.json`;

	util.log("Getting list of registered webhooks...");

	return request.get({
		url: url,
		headers: {
			"Authorization": `Bearer ${token}`
		},
		json: true
	}).then((body) => {
		if (body.length > 0) {
			let valid = body[0].valid;
			if (valid) {
				util.log(`A webhook with id ${body[0].id} already exists which is also valid. Passing the id onwards...`);
				return { id: body[0].id };
			} else {
				util.log(`A webhook with id ${body[0].id} already exists which is NOT valid. Re-triggering the CRC...`);
				return { id: body[0].id };
			}
		} else {
			util.log('No valid webhook found. Registering new webhook...');
			return registerWebhook().then((body) => {
				util.log(`Registered new webhook with id ${body.id}.`);
				return { id: body.id };
			});
		}
	})
}

function registerWebhook() {
	let url = `https://api.twitter.com/1.1/account_activity/all/${process.env.TWITTER_DEV_ENV}/webhooks.json`;

	return request.post({
		url: url,
		qs: { url: process.env.WEBHOOK_URL },
		json: true,
		oauth: twitter_oauth,
	});
}

function registerSubscriptions() {
	let url = `https://api.twitter.com/1.1/account_activity/all/${process.env.TWITTER_DEV_ENV}/subscriptions.json`;

	return request.post({
		url: url,
		oauth: twitter_oauth,
		json: true,
	});
}