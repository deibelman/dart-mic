var mic = new Microphone();
mic.initialize();

setInterval(function() {  
    console.log(mic.getFreq(1) + ", " + mic.getNote(1));
}, 200);
