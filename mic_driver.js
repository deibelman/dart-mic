var mic = new Microphone();
mic.initialize();
var note;

setInterval(function() {
    noteInfo = mic.getCurrentNoteAndCentsOffset();
    ampInDB = mic.getMaxInputAmplitude();
    console.log(noteInfo + "," + ampInDB);   
}, 500);
