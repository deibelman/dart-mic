function playDemo(timesToLoop) {
		var mic = new Microphone();
    var song = document.getElementById('demo');
    var length = Math.round(song.duration*1000) + 1000;
    console.log(length);
    var i = 0;
    loop(song, i, length, timesToLoop, mic);
}

function loop(song, iter, delay, timesToLoop, mic) {
    song.play();
    var i = iter + 1;
    console.log('Loop ' + i);
    while(!(song.ended)) {
    	setTimeout( function() {
    			console.log(mic.getNote(1));
    	}, 100);
    }
    loop(song, i, length, timesToLoop);
}

function loop(song, iter, delay, timesToLoop) {
    song.play();
    var i = iter + 1;
    console.log('Loop ' + i);
    if (i < timesToLoop) {
        setTimeout( function() {
            loop(song, i, delay, timesToLoop);
        }, delay);
    }
    else {
    	setTimeout( function() {
    			// Write to text file form array
    	}, delay);
    }
}
