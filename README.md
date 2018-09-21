# bird-notify

A simple piece of server software, which periodically (as often as twitter allows) checks the twitter timeline API for new tweets and broadcasts them via socket.io to connected clients.

I simply want to get notifications on my computer when new tweets are sent out and in the past this was very simple with the Streaming API. Unfortunately, twitter killed this API in August 2018 and I had to come up with something new.

## Installation

Simply clone this repository and run

    npm install

## Configuration

All the configuration is done with environment variables, which need to be set prior to running this server.
Most of these values is retrieved from the [Twitter Developer Platform](https://developer.twitter.com/) in a few steps:

1. Apply for a developer account: https://developer.twitter.com/en/apply/user
2. Create a new app: https://developer.twitter.com/en/apps
3. On the same page (https://developer.twitter.com/en/apps), click on "Details" and then on "Permissions" at the top.
4. Set the permissions to "Read, write, and direct messages"
5. Click on "Keys and tokens" at the top. Here you can see your "Consumer API keys" and have the option to generate an Access token and Access token secret by clicking on "Create".

The environment variables are as follows:

- **API_KEY**: *Consumer API keys* > API key
- **API_SECRET**: *Consumer API keys* > API secret key
- **OAUTH_ACCESS_TOKEN**: *Access token & access token secret* > Access token
- **OAUTH_SECRET**: *Access token & access token secret* > Access token secret
- **HTTP_ADDRESS**: Address to bind the server to (optional)
- **HTTP_PORT**: Port to run the server on
- **AUTH_CODE**: Code/password of your choosing, which clients need to supply before connecting (optional)

You can either set these variables in your shell (`export API_KEY="<API key>"` etc.) or by creating a file called `.env` in the application directory and putting them in there, one variable per line, e.g. `API_KEY="<API key>"`.

## Running the app

If you have configured everything correctly, you can run

    node ./

in the application directory and connect to it similar to this:

```javascript
const io = require('socket.io-client)';
var socket = io("http://localhost:8080?code=supersecretcode");

socket.on("tweet", (tweet) => {
/**
 * tweet contains: 
 * {
 *   text: <content of the tweet>
 * 	 created_at: <millisecond timestamp>,
 * 	 user: {
 * 	   name: <username>,
 * 	   screen_name: <display name>,
 * 	   profile_image_url: <self explanatory>
 *   }
 * }
 */
});

socket.on("status", (status) => {
/**
 * status contains information about clients connecting/disconnecting
 */ 
})
```

In this example `HTTP_ADDRESS` was set to `"localhost"`, `HTTP_PORT` to `8080` and `AUTH_CODE` to `"supersecretcode"`.