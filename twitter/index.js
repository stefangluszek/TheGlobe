// Description: This script connects to the Twitter API and streams tweets that have a geo location.

const needle = require('needle');
const fs = require('fs');

const token = process.env.BEARER_TOKEN;

const queueSize = process.env.QUEUE_SIZE || 1000;
const storeInterval = (process.env.STORE_INTERVAL || 60) * 1000;
const dataFile = process.env.DATA_FILE || "data.json";

// Yeah, I know, but you can't filter by nothing.
// So let's search for tweets including any letters of the english alphabet.
const alphabet = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

const q = `(${alphabet.join(" OR ")}) has:geo`;


const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';

const rules = [
    {
        'value': q,
        'tag': 'geo'
    }];

async function getAllRules() {

    console.log("Getting rules...");

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    });

    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode);
        throw new Error(response.body);
    }

    return (response.body);
}

async function deleteAllRules(rules) {

    console.log("Deleting rules...");

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    });

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);
}

async function setRules() {

    console.log("Setting rules...");

    const data = {
        "add": rules
    };

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 201) {
        console.log("Error:", response.statusMessage, response.statusCode, response.body);
        throw new Error(response.body);
    }

    return (response.body);
}

function streamConnect(retryAttempt) {
    let queue = [];
    let hits = {
        hits: queue
    };
    let lastWritten = 0;

    if (fs.existsSync(dataFile)) {
        try {
            queue = JSON.parse(fs.readFileSync(dataFile));
        } catch (e) {
            console.log("Error reading data file. Starting with empty queue.");
        }
    }

    console.log("Connecting to stream...");

    const params = {
        'tweet.fields': 'geo',
        'expansions': 'geo.place_id',
        'place.fields': 'geo',
    }

    const stream = needle.request('get', streamURL, params, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });

    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            if (json.data.geo.coordinates) {
                if (json.data.geo.coordinates.type === "Point") {
                    let coordinates = json.data.geo.coordinates.coordinates;
                    // TODO: Aggregate tweets by coordinates.
                    coordinates.push(1);
                    hits.queue.push(coordinates);
                    console.log(coordinates);
                    if (Date.now() - lastWritten > storeInterval * 1000) {
                        console.log(hits);
                        fs.writeFileSync(dataFile, JSON.stringify(hits));
                        lastWritten = Date.now();
                    }
                }
                if (queue.length > queueSize) {
                    queue.shift();
                }
            }
            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else if (data.errors) {
                console.log(data.errors);
                process.exit(1);
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt);
        }
    }).on('close', () => {
        console.log("Stream closed.");
        console.log("Dumping the queue to file...");
        console.log("Exiting...");
        fs.writeFileSync(dataFile, JSON.stringify(hits));
        process.exit(1);
    });

    return stream;
}


(async () => {
    let currentRules;

    try {
        // Gets the complete list of rules currently applied to the stream
        currentRules = await getAllRules();

        // Delete all rules. Comment the line below if you want to keep your existing rules.
        await deleteAllRules(currentRules);

        // Add rules to the stream. Comment the line below if you don't want to add new rules.
        await setRules();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    // Listen to the stream.
    const stream = streamConnect(0);


    process.on('SIGINT', () => {
        stream.emit('close');
    });

})();
