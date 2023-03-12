const EXPRESS = require('express')
const APP = EXPRESS()
const HTTP = require('http').createServer(APP);

const PORT = process.env.PORT || 8080  // Port TCP
const URL_REPO = process.env.URL_REPO || "/kharto" // http://example.org<URL_REPO>/

const IO = require('socket.io')(HTTP, {path: URL_REPO + '/socket.io'}); // example.org<URL_REPO>/socket.io


const PLAYERS = {};

/**
 * HTTP Routes
 */
HTTP.listen(PORT, function () {
    console.log(`Server is running at http://localhost:${PORT}${URL_REPO}`);
})
APP.use(URL_REPO, EXPRESS.static('public')) // Expose public directory
    .get(URL_REPO + '/', function (req, res) {
        res.sendFile(__dirname + '/kharto.html');
    })
    .get(URL_REPO + '/rules', function (req, res) {
        res.sendFile(__dirname + '/rules.html');
    });

/**
 * When someone connect to the server socket.
 */
IO.on("connection", function (socket) {
    // Generate an ID to the client
    // TODO : Ensure the ID is unique
    const PLAYER_ID = generateId();
    socket.shortid = PLAYER_ID;
    console.log("[CONNECTION] " + socket.shortid);

    // Give the ID to the client
    socket.emit('game.connect', {
        id: socket.shortid,
    });

    // Get Query Params [http://example.org?op=<OP_ID>]
    const SOCKET_URL = new URL(socket.handshake.headers.referer);
    const OP_ID = SOCKET_URL.searchParams.get('op')

    if (OP_ID && joinGame(socket, OP_ID)) {
        const OP = getOpponent(PLAYER_ID)

        // Determine the first player randomly
        socket.start = (Math.random() < 0.5);
        OP.start = !socket.start;

        // Tell to both player the game is beginning and who's playing first.
        socket.emit("game.begin", {
            playing: socket.start,
        });
        OP.emit("game.begin", {
            playing: OP.start,
        });

    } else createGame(socket);

    /**
     * When the socket has disconnected
     */
    socket.on("disconnect", function () {
        console.log("[DISCONNECT] " + socket.shortid);
        const OP = getOpponent(PLAYER_ID);
        if (OP) { // Check the player still have an opponent
            // Tell to the opponent that his opponent has left. (Wow brain injury)
            OP.emit("opponent.left");
            PLAYERS[OP.shortid].opponent = null;
        }
        delete PLAYERS[PLAYER_ID];
    });

    /**
     * The player has made a move
     */
    socket.on("game.play", function (data) {
        console.log("[GAME.PLAY] " + socket.shortid + " | " + data);
        const OP = getOpponent(PLAYER_ID);
        if (!OP) return; // Check the player still have an opponent
        // Send/Validate the move to both
        socket.emit("game.play", data);
        OP.emit("game.play", data);
    });

    /**
     * The player ask to wizz his opponent
     */
    socket.on("game.wizz", function () {
        const OP = getOpponent(PLAYER_ID);
        if (OP) { // Check the player still have an opponent
            OP.emit("game.wizz");
        }
    });

    /**
     * The player ask for a rematch
     */
    socket.on("game.rematch", function () {
        const OP = getOpponent(PLAYER_ID);
        if (!OP) return;
        if (OP.rematch) { // If the opponent already asked for a rematch
            OP.rematch = false; // Reset value

            // Swap the first player to be fair.
            socket.start ^= 1;
            OP.start ^= 1;

            // Send Game begin to both
            socket.emit("game.begin", {
                playing: socket.start,
            });
            OP.emit("game.begin", {
                playing: OP.start,
            });
        } else {
            socket.rematch = true;
            OP.emit("game.rematch");
        }
    });
});


/**
 * Add a new player to the list
 * @param playerSocket player socket to put in the list
 */
function createGame(playerSocket) {
    PLAYERS[playerSocket.shortid] = {
        opponent: null,
        socket: playerSocket
    };
}

/**
 * Associate a player and an opponent
 * @param playerSocket socket of the player
 * @param opponentId short id of the opponent's socket
 * @returns {boolean} true if the association has been made, false otherwise.
 */
function joinGame(playerSocket, opponentId) {
    if (!PLAYERS[opponentId]) return false; // If there's no opponent

    // Check if the opponent is already playing against someone
    else if (PLAYERS[opponentId].opponent && PLAYERS[PLAYERS[opponentId].opponent]) return false;

    // Associate the opponent to the player.
    PLAYERS[playerSocket.shortid] = {
        opponent: PLAYERS[opponentId].socket.shortid,
        socket: playerSocket
    };

    // Associate the player to his opponent.
    PLAYERS[opponentId].opponent = playerSocket.shortid;
    return true;
}

/**
 * Get if existing the opponent socket associated to the given socket.
 * @param playerId Player socket
 * @returns {*} Opponent socket
 */
function getOpponent(playerId) {
    // Check null values
    if (!PLAYERS[playerId]) return;
    else if (!PLAYERS[playerId].opponent) return;
    else if (!PLAYERS[PLAYERS[playerId].opponent]) return;

    // Return opponent socket
    else return PLAYERS[PLAYERS[playerId].opponent].socket;
}

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const ID_SIZE = 4;

/**
 * Generate an unique alphanumeric ID
 * @returns {string} Unique Alphanumeric ID
 */
function generateId() {
    // Generate a random INTEGER value
    const MIN = CHARSET.length ** (ID_SIZE - 1);
    const MAX = CHARSET.length ** ID_SIZE
    let id = Math.trunc(Math.random() * (MAX - MIN) + MIN);

    // Find an unique ID
    let strId;
    do {
        strId = convertIntToStrId(id); // convert the INTEGER value to an alphanumeric id
        id = (id + 1) % (CHARSET.length * ID_SIZE); // id++ if the id is not unique
    } while (PLAYERS[strId]);
    return strId;
}

/**
 * Convert INTEGER ID to Alphanumeric ID
 * @param intId INTEGER ID from CHARSET.length ** (ID_SIZE - 1) to CHARSET.length ** ID_SIZE
 * @returns {string} Alphanumeric ID with CHARSET character
 */
function convertIntToStrId(intId) {
    let stringId = "";
    while (intId > 0) {
        stringId += CHARSET.charAt(intId % CHARSET.length);
        intId = Math.trunc(intId / CHARSET.length);
    }
    return stringId;
}