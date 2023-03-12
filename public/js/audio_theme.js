const AUDIO = {
    notify: new Audio('./sound/notify.mp3'),
    error: new Audio('./sound/error.mp3'),
    victory: new Audio('./sound/victory.mp3'),
    fail: new Audio('./sound/fail.mp3'),
    move: new Audio('./sound/chessmove.wav')
};

let muted = true;
let doublecheck = false;

function switchVolume() {
    muted ^= 1;
    if (muted) {
        $(".volume").text("volume_off");
        for (const [key, audio] of Object.entries(AUDIO)) {
            audio.pause();
            audio.currentTime = 0;
        }
    } else {
        $(".volume").text("volume_up");
        AUDIO.notify.play();
    }
}

function swapTheme() {
    let root = document.documentElement; // Get the whole document

    if (root.className === "light-theme") { // If light theme
        root.className = "dark-theme"; // Swap to dark theme in cookie
    } else { // Else
        root.className = "light-theme"; // Swap to light theme in cookie
    }
    if (!muted) new Audio('./sound/chessmove.wav').play();
}

function language(){
 // TODO: WIP
}

function check(){
    doublecheck ^= 1;
    if (doublecheck) {
        $(".check").text("done_all");
    }else{
        $(".check").text("done");
    }
    if (!muted) new Audio('../sound/chessmove.wav').play();

}

$(document).ready(function () {
    document.documentElement.className = "dark-theme";
    $('.volume').on("click", switchVolume);
    $('.theme-swapper').on("click", swapTheme);
    $('.check').on("click", check);
});