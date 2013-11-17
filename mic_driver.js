var mic = new Microphone();
mic.initialize();

setInterval(function() {
	document.getElementById('autoNote').innerHTML = mic.getNote(1);	
	document.getElementById('fftNote').innerHTML = mic.getNote(2);	
}, 100);

/*setInterval(function() {  
    console.log(mic.getFreq(1) + ", " + mic.getNote(1));
}, 100);*/
