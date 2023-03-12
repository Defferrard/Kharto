const DEFAULT_PAGE_TITLE = 'Kharto'
const URL = window.location.href.split('?')[0];
const MAP_SIDE_LENGTH = 4;
const BUTTON_ID = {
    // [y][x]
    "a0": [0, 0],
    "a1": [0, 1],
    "a2": [0, 2],
    "a3": [0, 3],
    "b0": [1, 0],
    "b1": [1, 1],
    "b2": [1, 2],
    "b3": [1, 3],
    "c0": [2, 0],
    "c1": [2, 1],
    "c2": [2, 2],
    "c3": [2, 3],
    "d0": [3, 0],
    "d1": [3, 1],
    "d2": [3, 2],
    "d3": [3, 3],
}

const MAP_BUTTON = [
    ["a0", "a1", "a2", "a3"],
    ["b0", "b1", "b2", "b3"],
    ["c0", "c1", "c2", "c3"],
    ["d0", "d1", "d2", "d3"]
]

let code = undefined;

let socket = io({path: '/kharto/socket.io'});

let game_finished = false;
let available_tokens = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // Available tokens, check bits to get similarity
let chosen_token = -1;
// Map[y][x]. -1 is no token placed on the cell, otherwise the number correspond to the token.
let map = [
    [-1, -1, -1, -1],
    [-1, -1, -1, -1],
    [-1, -1, -1, -1],
    [-1, -1, -1, -1]
];

const MAX_TURN = 4;
/* Start at pos 1 or 3
0: I place Token on the board
1: I choose Token for Opponent
2: Opponent place Token on the board
3: Opponent choose Token for I
 */
let turn = 1;


function isMyTurn() {
    return (turn & 2) !== 2 // Check the second bit
}

function isChoosingTurn() {
    return (turn & 1) === 1 // Check the first bit

}

function nextTurn() {
    turn = (turn + 1) % MAX_TURN;
}

function copyCode() {

    function copied(){
        $('#copied').removeClass("hidden");
        setTimeout(function () {
            $('#copied').addClass("hidden");
        }, 5000);
    }
    let codeurl = URL + "?op=" + code;
    if (!navigator.clipboard){
        // use old commandExec() way
        let temp = $("<input>");
        $("body").append(temp);
        temp.val(codeurl).select();
        document.execCommand("copy");
        temp.remove();
        copied();
    } else
    navigator.clipboard.writeText(codeurl)
        .then(() => {
            copied();
        }).catch(() => {
            alert(codeurl);
        });
}

$(function () {
    setupGame();

    socket.on("game.connect", function (data) {
        code = data.id;
        $('.code-container').on("click", copyCode).removeClass("hidden");
        $('.code').text(code);
    });

    // Event is called when either player makes a move
    socket.on("game.play", function (data) {

        // Render the move
        if (isChoosingTurn()) {
            chosen_token = data.token;
            available_tokens[chosen_token] = -1;

            $(".available-tokens button[value=\"" + chosen_token + "\"]").remove(); // Remove the token as available token
        } else { // Place chosen_token on the map
            let id = MAP_BUTTON[data.position[0]][data.position[1]];
            $("#" + id).attr("value", chosen_token); // Place the token on the board
            map[data.position[0]][data.position[1]] = chosen_token;
            chosen_token = -1;
        }
        $("#chosen-token").attr("value", chosen_token); // Place the token as chosen token (-1 or token value)
        nextTurn();

        if (!muted) {
            if ((document.hasFocus())) { // Now it's your turn !
                AUDIO.move.play();
            } else if (isMyTurn()) {
                AUDIO.notify.play();
            }
        }

        // If the game is still going, show who's turn it is
        if (!isGameOver()) {
            if (gameTied()) {
                game_finished = true;
                $("#tip").text("").append("<br/>");
                $("#messages").text("Tie..");
                $(".board button").attr("disabled", true);
                if (!muted) AUDIO.fail.play();
                document.title = DEFAULT_PAGE_TITLE + " - Game Tie.."
                showRematch();
            } else {
                renderTable();
            }
            // If the game is over
        } else {
            // Disable the board
            $(".board button").attr("disabled", true);

            game_finished = true;
            document.title = DEFAULT_PAGE_TITLE;
            $("#tip").text("").append("<br/>");
            // Show the result message
            if (isMyTurn()) {
                $("body").append("<canvas id='canvas'><script src='js/fireworks.js'></script></canvas>");
                loop();
                $("#messages").text("");
                $(".game-over").text("You won !").removeClass("hidden");
                if (!muted) AUDIO.victory.play();
                document.title += " - You won !"
            } else {
                $("#messages").text("");
                $(".game-over").text("Game over, you lost..").removeClass("hidden");
                if (!muted) AUDIO.fail.play();
                document.title += " - You lost.."
            }
            showRematch();
        }
    });

    // Set up the initial state when the game begins
    socket.on("game.begin", function (data) {
        setupGame();
        if (!data.playing) turn += 2; // Opponent plays first !
        $('.friend-invite').addClass("hidden");
        $('.code-container').addClass("hidden");
        renderTable();
        if (!muted) AUDIO.move.cloneNode(true).play();
    });

    socket.on("game.rematch", function () {
        if(!game_finished) return;
        $('#messages').text("Your opponent wants a rematch !")
        if (!muted) AUDIO.notify.play();
    });

    // Disable the board if the opponent leaves
    socket.on("opponent.left", function () {
        game_finished = true;
        $(".board button").attr("disabled", true);
        $("#tip").text("").append("<br/>");
        $("#messages").text("Opponent has left the game.");
        $('.friend-invite').removeClass("hidden");
        $('.code-container').removeClass("hidden");
        $('.rematch').addClass("hidden").off("click");
        $(".game-over").addClass("hidden");
        ctx = undefined;
        $("canvas").remove();
        document.title = "Opponent has left the game.."
        if (!muted) AUDIO.error.play();
    });
    socket.on("game.wizz", function () {
        $(".board").effect("shake", {times: 1}, 100);
        if (!muted) AUDIO.move.cloneNode(true).play();
    });
});

function setupGame() {
    // Setup table
    game_finished = false;
    available_tokens = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    chosen_token = -1;
    map = [
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1]
    ];
    turn = 1;

    $('.rematch').addClass("hidden").off("click");
    $(".available-tokens > .col0").empty();
    $(".available-tokens > .col1").empty();
    for (let i = 0; i < available_tokens.length; i++) {
        $(".available-tokens > .col" + (i % 2)).append("<button value='" + i + "' disabled='true'></button>");
    }


    // Setup buttons
    $(".placed-tokens button").attr("disabled", true)
        .attr("value", -1);
    $(".board button").off("click")
        .on("click", makeMove)
        .empty()
        .append("<img class='kharto-icon'/>");
    $(".game-over").addClass("hidden");
    ctx = undefined;
    $("canvas").remove();

}

function gameTied() {
    for (let y = 0; y < MAP_SIDE_LENGTH; y++) {
        for (let x = 0; x < MAP_SIDE_LENGTH; x++) {
            if (map[y][x] < 0) return false;
        }
    }
    return true;
}

// t1, t2, t3, t4 should be integer < 16
function compareTokens(t1, t2, t3, t4) {
    if (t1 < 0 || t2 < 0 || t3 < 0 || t4 < 0) return false; // Check every token is defined

    // Binary Comparaison
    else if ((t1 & t2 & t3 & t4) !== 0) return true; // Check if every token have 1 on the same position
    else if ((t1 | t2 | t3 | t4) !== 15) return true;// Check if every token have 0 on the same position
    else return false; // Otherwise
}

function isGameOver() {
    // Check Lines
    for (let i = 0; i < MAP_SIDE_LENGTH; i++) {
        if (compareTokens(map[i][0], map[i][1], map[i][2], map[i][3]))
            return true;
        if (compareTokens(map[0][i], map[1][i], map[2][i], map[3][i]))
            return true;
    }

    // Check Diagonals
    if (compareTokens(map[0][0], map[1][1], map[2][2], map[3][3]))
        return true;
    if (compareTokens(map[0][3], map[1][2], map[2][1], map[3][0]))
        return true;

    return false;
}

function renderTable() {
    // Disable the board by default
    $(".board button").attr("disabled", true);

    if (isMyTurn()) {
        document.title = "It's your turn !";
        if (isChoosingTurn()) { // Enable available buttons.
            $("#messages").text("Your turn !");
            $("#tip").text("Choose a piece for your opponent..");
            $(".available-tokens button").removeAttr("disabled");
        } else {
            $("#messages").text("Your turn !");
            $("#tip").text("Place on the board, the piece that your opponent has chosen..");
            $(".placed-tokens button[value='-1']").removeAttr("disabled");
            $("#chosen-token").removeAttr("disabled");
        }
    } else {
        document.title = "Waiting for your opponent..";
        $("#messages").text("Opponent's turn...");
        $("#tip").text("").append("<br/>");
    }
}


function makeMove(e) {
    e.preventDefault();
    if (!isMyTurn()) return; // It's not your turn
    else if (isChoosingTurn()) {
        if ($(this).attr("value") < 0) return; // No value on the button ?

        // Emit the move to the server
        socket.emit("game.play", {
            token: $(this).attr("value")
        });
    } else {
        if ($(this).attr("value") >= 0) return; // There already a token on this cell

        // Emit the move to the server
        socket.emit("game.play", {
            token: chosen_token,
            position: BUTTON_ID[$(this).attr("id")]
        });
    }
}

function askRematch() {
    socket.emit("game.rematch");
    $("#messages").text("Waiting for your opponent to rematch..");
    document.title = "Waiting for rematch..";
    $('.rematch').addClass("hidden")
        .off("click");
    if (!muted) AUDIO.move.play();
}

function showRematch() {
    $('.rematch').removeClass("hidden")
        .on("click", askRematch);
}

document.body.onkeyup = function (e) {
    if (e.keyCode === 32) {
        socket.emit("game.wizz");
    }
}