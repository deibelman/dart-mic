var mic = new Microphone();
mic.initialize();

setInterval(function() {
	document.getElementById('autoNote').innerHTML = mic.getNote(1);
	document.getElementById('autoCents').innerHTML = mic.getNoteCents(1)[1];
	document.getElementById('fftNote').innerHTML = mic.getNote(2);
	document.getElementById('fftCents').innerHTML = mic.getNoteCents(2)[1];
}, 100);

