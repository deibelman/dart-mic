var mic = new Microphone();
mic.initialize();

setInterval(function() {
	document.getElementById('note').innerHTML = mic.getNote(1);		
}, 100);

/*setInterval(function() {  
    console.log(mic.getFreq(1) + ", " + mic.getNote(1));
}, 100);*/
