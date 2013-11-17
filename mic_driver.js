var mic = new Microphone();
mic.initialize();

setInterval(function() {
	document.getElementById('note').innerHTML = mic.getNote(1);		
}, 500);

/*setInterval(function() {  
    console.log(mic.getFreq(1) + ", " + mic.getNote(1));
}, 100);*/
