# Tweets around the globe - 🐦

This is a simple script that opens a stream of tweets including a GEO location and stores the last N locations in a file.

## Running the script

### Prerequisites
You will need to have a Twitter developer account and create an app to get a Bearer token.

### locally

```bash
$ npm install
$ export BEARER_TOKEN=<your_api_token>
$ node index.js
```

### with Docker

```bash
$ docker build -t tweets-around-the-globe:local .
$ export BEARER_TOKEN=<your_api_token>
$ docker run --rm -it -e BEARER_TOKEN=$BEARER_TOKEN  tweets-around-the-globe:local
```

### Supported environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `BEARER_TOKEN` | Twitter API Bearer token | |
| `DATA_FILE` | File to store the geo locations | `data.json` |
| `QUEUE_SIZE` | Number of geo locations to store (FIFO) | `1000` |
| `STORE_INTERVAL` | How often to store the geo locations in the file, in seconds | `60` |
