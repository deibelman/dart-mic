/* =============================================================================

File: microphone.js

Authors: Patrick Yukman and Max Deibel

Description: See README for usage.

============================================================================= */


// =============================================================================
// Constructor/class for Microphone
// =============================================================================

// The microphone class allows us to define a set of private variables that
// have global scope within the microphone object's set of functions. We
// encapsulate a number of internal helper functions as well, but allow 
// outside access to a function foo with the command: 
//
//          this.foo = function(param) { ...
//
// This function can then be accessed (after a microphone object "mic" is 
// initialized) by calling:
//
//          mic.foo(param);

function Microphone() {
    var that = this;
    var initialized;
    var context;
    var inputHardware; // aka, whatever the user has for a microphone
    var SAMPLE_RATE;
    var timeData;
    var procNode;
    var BUFFER_LEN;
    var MIN_SUPPORTED_FREQ;
    var MAX_PEAK_SEARCH;
    var fft;
    var spectrum;
    var MY_FFT_SIZE;
    var FFT_FREQ_RES;
    var processing;
    var recording;
    var recordingLength;
    var leftChannel;
    var rightChannel;
    var notes; // A JSON look-up table to get notes from frequencies

// -----------------------------------------------------------------------------
// initialize function. Properly initializes the parameters of a Microphone 
// object, defines the frequency-->note lookup table, and calls getUserMedia
// to request browser-level access to a user's microphone. In general, do not
// change any part of this initialize function without a compelling reason.
    
    this.initialize = function() {
        // Set parameters
        initialized = false;
        context = null;
        inputHardware = null;       // Microphone
        SAMPLE_RATE = 44100;
        timeData = null;
        procNode = null;
        BUFFER_LEN = 1024;          // Keep a power of 2, but can change to
                                    // provide more data, increased resolution
        MIN_SUPPORTED_FREQ = 60;
        MAX_PEAK_SEARCH = (SAMPLE_RATE/MIN_SUPPORTED_FREQ);
        fft = null;
        spectrum = null;
        MY_FFT_SIZE = BUFFER_LEN;
        FFT_FREQ_RES = (SAMPLE_RATE/2)/(MY_FFT_SIZE/2);
        processing = false;
        recording = false;
        recordingLength = 0;
        leftChannel = [];
        rightChannel = [];
        notes = {"A#1" : 58.2705, "B1" : 61.7354, "C2" : 65.4064, 
            "C#2" : 69.2957, "D2" : 73.4162, "D#2" : 77.7817, "E2" : 82.4069, 
            "F2" : 87.3071, "F#2" : 92.4986, "G2" : 97.9989, "G#2" : 103.826, 
            "A2" : 110, "A#2" : 116.542, "B2" : 123.471, "C3" : 130.813, 
            "C#3" : 138.591, "D3" : 146.832, "D#3" : 155.563, "E3" : 164.814, 
            "F3" : 174.614, "F#3" : 184.997, "G3" : 195.998, "G#3" : 207.652, 
            "A3" : 220, "A#3" : 233.082, "B3" : 246.942, "C4" : 261.626, 
            "C#4" : 277.183, "D4" : 293.665, "D#4" : 311.127, "E4" : 329.628, 
            "F4" : 349.228, "F#4" : 369.994, "G4" : 391.995, "G#4" : 415.305, 
            "A4" : 440, "A#4" : 466.164, "B4" : 493.883, "C5" : 523.251, 
            "C#5" : 554.365, "D5" : 587.330, "D#5" : 622.254, "E5" : 659.255, 
            "F5" : 698.456, "F#5" : 739.989, "G5" : 783.991, "G#5" : 830.609, 
            "A5" : 880, "A#5" : 932.328, "B5" : 987.767, "C6" : 1046.5, 
            "C#6" : 1108.73, "D6" : 1174.66, "D#6" : 1244.51, "E6" : 1318.51, 
            "F6" : 1396.91, "F#6" : 1479.98, "G6" : 1567.98, "G#6" : 1661.22, 
            "A6" : 1760, "A#6" : 1864.66, "B6" : 1975.53, "C7" : 2093, 
            "C#7" : 2217.46, "D7" : 2349.32, "D#7" : 2489.02, "E7" : 2637.02, 
            "F7" : 2793.83, "F#7" : 2959.96, "G7" : 3135.96, "G#7" : 3322.44, 
            "A7" : 3520, "A#7" : 3729.31, "B7" : 3951.07, "C8" : 4186.01};

        // Make a note that the microphone is about to be accessed
        console.log('Beginning!');

        // Normalize the various vendor prefixed versions of getUserMedia
        navigator.getUserMedia = (navigator.getUserMedia ||
                                  navigator.webkitGetUserMedia ||
                                  navigator.mozGetUserMedia ||
                                  navigator.msGetUserMedia);

        // Check that browser supports getUserMedia
        if (navigator.getUserMedia) {
            // Request the microphone
            navigator.getUserMedia({audio:true}, gotStream, noStream);
        }
        else {
            alert('Sorry, your browser does not support getUserMedia');
        }
    };

// -----------------------------------------------------------------------------
// gotStream function. This function is the success callback for getUserMedia
// and initializes the Web Audio API / DSP.JS structures that allow us to
// manipulate the data streaming in off the microphone.
    
    function gotStream(stream) {
        console.log('gotStream called');
        // Create the audio context
        audioContext = window.AudioContext || window.webkitAudioContext;
        context = new audioContext();

        // Set up variables to perform FFT
        timeData = [];
        fft = new FFT(MY_FFT_SIZE, SAMPLE_RATE);

        // Set up a processing node that will allow us to pass mic input off to
        // the DSP library for frequency domain analysis
        procNode = context.createScriptProcessor(BUFFER_LEN, 1, 1);
        procNode.onaudioprocess = function(e) {
            timeData = e.inputBuffer.getChannelData(0);
            if (recording) {
                leftChannel.push(new Float32Array(timeData));
                rightChannel.push(new Float32Array(timeData));
                recordingLength += BUFFER_LEN;
            }
        };
        
        // Create an audio source node from the microphone input to eventually 
        // feed into the processing node
        inputHardware = context.createMediaStreamSource(stream);
        procNode.connect(context.destination); // Node must have a destination
                                               // to work. Weird. 
        console.log('gotStream finished');
        initialized = true;
    }

// -----------------------------------------------------------------------------
// noStream function. This function is the failure callback for getUserMedia
// and alerts the user if their browser doesn't support getUserMedia.

    function noStream(e) {
        alert('Error capturing audio.');
    }
    
// -----------------------------------------------------------------------------
// isInitialized function. This function simply returns whether or not the 
// microphone object has been fully initialized (indicated by the var 
// 'initialized' being equal to true. Returns a boolean value.

    this.isInitialized = function() {
        if (initialized) {
            return true;
        }
        else {
            return false;
        }
    };

// -----------------------------------------------------------------------------
// startListening function. Connects the microphone input to a processing node
// for future operations. Throws an error if the microphone hasn't been
// initialized before this function is called -- in other words, if a user
// tries to get mic data before allowing the browser permission to collect it.
    
    this.startListening = function() {
        if (!initialized) {
            throw "Not initialized";
        }
        else {
            console.log('Now listening');
            if (!processing) {
                    processing = true;
                    // connect mic input so we can process it whenever we want
                    inputHardware.connect(procNode);
            }
        }
    };

// -----------------------------------------------------------------------------
// stopListening function. Disconnects the microphone input. Can be called or
// tied to a button to save on processing.

    this.stopListening = function() {
        console.log('Done listening');
        if (processing && !recording) {
            processing = false;

            // Stop processing audio stream
            inputHardware.disconnect();
        }
    };
    
// -----------------------------------------------------------------------------
// startRecording function. Begins gathering microphone input and storing it in
// a WAV file.

    this.startRecording = function() {
        if (!initialized || !processing) {
            throw "Microphone not initialized / not processing";
        }
        else {
            console.log('Now recording');
            if (!recording) {
                recording = true;
            }
        }
    };

// -----------------------------------------------------------------------------
// stopRecording function. Stops packaging incoming microphone data into WAV
// file.

    this.stopRecording = function() {
        console.log('Done recording');
        if (recording) {
            recording = false;
            writeToWav();
        }
    };

// =============================================================================
// General Purpose Functions
// =============================================================================

// -----------------------------------------------------------------------------
// matchNote function. Input: frequency, in Hertz. Output: closest note 
// value to that frequency. This function iterates over the JSON lookup table
// to find the nearest note to the input frequency and returns the note as a
// string.

    function matchNote(freq) {
        var closest = "A#1"; // Default closest note
        var closestFreq = 58.2705;
        for (var key in notes) { // Iterates through note look-up table
                // If the current note in the table is closer to the given
                // frequency than the current "closest" note, replace the 
                // "closest" note.
            if (Math.abs(notes[key] - freq) <= Math.abs(notes[closest] - freq)) {
                closest = key;
                closestFreq = notes[key];
            }
            // Stop searching once the current note in the table is of higher 
            // frequency than the given frequency.
            if (notes[key] > freq) {
                break;
            }
        }

        return [closest, closestFreq];
    }

// -----------------------------------------------------------------------------
// getMaxInputAmplitude function. Input: none. Output: the amplitude of the
// microphone signal, expressed in deciBels (scaled from -120). Gives an idea
// of the volume of the sound picked up by the microphone.

    this.getMaxInputAmplitude = function() {
        var minDb = -120;
        var minMag = Math.pow(10.0, minDb / 20.0);
        var m = timeData[0];
         
        for (var i = 0; i < timeData.length; i++) {
            if (timeData[i] > m) {
                m = timeData[i];
            }
        }
        
        return Math.round(20.0*Math.log(Math.max(m, minMag)));
    };

// -----------------------------------------------------------------------------
// getFreq function. Input: the method number (default is 1 to use
// autocorrelation, 2 to use FFT). Output: the detected frequency calculated via
// the selected method.
    
    this.getFreq = function(method) {
        if (!processing) {
            throw "Cannot compute frequency from null input";
        }
        if (method == 1) {
            return computeFreqFromAutocorr();
        }
        else if (method == 2) {
            return computeFreqFromFFT();
        }
    };
    
// -----------------------------------------------------------------------------
// getNote function. Input: the method number (default is 1 to use
// autocorrelation, 2 to use FFT). Output: the detected note calculated via
// the selected method.
    
    this.getNote = function(method) {
        if (!processing) {
            throw "Cannot compute frequency from null input";
        }
        if (method == 1) {
            return getNoteFromAutocorr();
        }
        else if (method == 2) {
            return getNoteFromFFT();
        }
    };
    
// -----------------------------------------------------------------------------
// getNoteCents function. Input: the method number (default is 1 to use
// autocorrelation, 2 to use FFT). Output: the detected note cents offset 
// calculated via the selected method.
    
    this.getNoteCents = function(method) {
        if (!processing) {
            throw "Cannot compute frequency from null input";
        }
        if (method == 1) {
            return getNoteCentsFromAutocorr();
        }
        else if (method == 2) {
            return getNoteCentsFromFFT();
        }
    };

// =============================================================================
// Autocorrelation Functions
// =============================================================================

// -----------------------------------------------------------------------------
// autocorrelate function. For each index in an array of length BUFFER_LEN,
// adds the data element at that index and the next index together, then stores
// it in a separate sums array.

    function autocorrelate(data) {
        var sums = new Array(BUFFER_LEN);
        var i, j;
        for (i = 0; i < BUFFER_LEN; i++) {
            sums[i] = 0;
            for (j = 0; j < BUFFER_LEN - i; j++) {
                sums[i] += data[j] * data[j+i];
            }
        }
        return sums;
    }

// -----------------------------------------------------------------------------
// getPeakPeriodicityIndex function. After finding the second zero crossing
// in the passed sums array, finds the max peak that occcurs after that crossing

    function getPeakPeriodicityIndex(sums) {
        // Find second zero crossing, start searching at that point
        for (i = 0; sums[i] >= 0 && i < BUFFER_LEN; i++) {}
        for (i = i; sums[i] < 0 && i < BUFFER_LEN; i++) {}
        var m = sums[i], maxIndex = i;
        for (i = i; i < MAX_PEAK_SEARCH; i++) {
            if (sums[i] > m) {
                m = sums[i];
                maxIndex = i;
            }
        }
        
        return maxIndex;
    }
    
// -----------------------------------------------------------------------------
// computeFreqFromAutocorr function. Gets the max peak index, and then 
// calculates the frequency by dividing the sample rate by that index.

    function computeFreqFromAutocorr() {
        var sums = autocorrelate(timeData);
        var maxIndex = getPeakPeriodicityIndex(sums);
        return Math.round(SAMPLE_RATE / maxIndex);
    }
    
// -----------------------------------------------------------------------------
// getNoteFromAutocorr function. Computes the current frequency with 
// computeFreqFromAutoCorr, then determines the current note by feeding the 
// current frequency to matchNote.

    function getNoteFromAutocorr() {
        var currFreq = computeFreqFromAutocorr();
        var noteInfo = matchNote(currFreq);
        return noteInfo[0];
    }

// -----------------------------------------------------------------------------
// getNoteCentsFromAutocorr function. Computes the current frequency with 
// computeFreqFromAutocorr, then determines the current note by feeding the 
// current frequency to matchNote, and finally computes the cents offset from 
// the current note.

    function getNoteCentsFromAutocorr() {
        var currFreq = computeFreqFromAutocorr();
        var noteInfo = matchNote(currFreq);
        var noteFreq = noteInfo[1];
        var cents = 1200*(Math.log(currFreq/Math.round(noteFreq))/Math.log(2));
        return [noteInfo[0], Math.round(cents)];
    }

// =============================================================================
// FFT Functions
// =============================================================================

// -----------------------------------------------------------------------------
// computeFreqFromFFT function. Input: none. Output: frequency of the sound 
// picked up by the microphone, computed via FFT. Automatically grabs the 
// current microphone data from the timeData global variable and uses the FFT
// defined in DSP.JS. Interpolates the FFT power spectrum to more accurately
// guess the actual value of the peak frequency of the signal.

    function computeFreqFromFFT() {
        fft.forward(timeData);   // See added dsp library for additional info
        spectrum = fft.spectrum;
        
        // Get index of maximum in spectrum array
        var i = 0, m = spectrum[0], maxIndex = 0;

        while (++i < spectrum.length) {
            if (spectrum[i] > m) {
                maxIndex = i;
                m = spectrum[i];
            }
        }

        // Make a best guess at the frequency of the signal
        interpolatedBin = jainsMethodInterpolate(spectrum, maxIndex);
        return Math.round(interpolatedBin*FFT_FREQ_RES);
    }

// -----------------------------------------------------------------------------
// jainsMethodInterpolate function. Input: array of spectrum power values 
// returned from FFT; index of bin in spectrum array with max power value.
// Output: a fractional bin number indicating the interpolated location of
// the actual signal peak frequency. Uses neighbouring indices to the index of 
// greatest magnitude to create a more accurate estimate of the frequency. 
// Simply multiply the returned fractional bin index by the FFT spectrum 
// frequency resolution to get the estimate of the actual peak frequency.

    function jainsMethodInterpolate(spctrm, maxIndex) {
        var m1, m2, m3, n, o;
        m1 = Math.abs(spctrm[maxIndex - 1]);
        m2 = Math.abs(spctrm[maxIndex]);
        m3 = Math.abs(spctrm[maxIndex + 1]);
        
        if (m1 > m3) {
            a = m2 / m1;
            d = a / (1 + a);
            return maxIndex - 1 + d;
        }
        else {
            a = m3 / m2;
            d = a / (1 + a);
            return maxIndex + d;
        }
    }

// -----------------------------------------------------------------------------
// getNoteFromFFT function. Computes the current frequency with 
// computeFreqFromFFT, then determines the current note by feeding the current
// frequency to matchNote

    function getNoteFromFFT() {
        var currFreq = computeFreqFromFFT();
        var noteInfo = matchNote(currFreq);
        return noteInfo[0];
    }

// -----------------------------------------------------------------------------
// getNoteCentsFromFFT function. Computes the current frequency with 
// computeFreqFromFFT, then determines the current note by feeding the current
// frequency to matchNote, and finally computes the cents offset from the 
// current note

    function getNoteCentsFromFFT() {
        var currFreq = computeFreqFromFFT();
        var noteInfo = matchNote(currFreq);
        var noteFreq = noteInfo[1];
        var cents = 1200*(Math.log(currFreq/Math.round(noteFreq))/Math.log(2));
        return [noteInfo[0], Math.round(cents)];
    }

// =============================================================================
// Recording Functions
// =============================================================================

// -----------------------------------------------------------------------------
// writeToWav function. Writes our recording data to a .WAV file.

    function writeToWav() {
        // we flat the left and right channels down
        var leftBuffer = mergeBuffers (leftChannel, recordingLength);
        var rightBuffer = mergeBuffers (rightChannel, recordingLength);
        // we interleave both channels together
        var interleaved = interleave (leftBuffer, rightBuffer);
        
        // we create our wav file
        var buffer = new ArrayBuffer(44 + interleaved.length * 2);
        var view = new DataView(buffer);
        
        // RIFF chunk descriptor
        writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + interleaved.length * 2, true);
        writeUTFBytes(view, 8, 'WAVE');
        // FMT sub-chunk
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        // stereo (2 channels)
        view.setUint16(22, 2, true);
        view.setUint32(24, SAMPLE_RATE, true);
        view.setUint32(28, SAMPLE_RATE * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        // data sub-chunk
        writeUTFBytes(view, 36, 'data');
        view.setUint32(40, interleaved.length * 2, true);
        
        // write the PCM samples
        var lng = interleaved.length;
        var index = 44;
        var volume = 1;
        for (var i = 0; i < lng; i++){
            view.setInt16(index, interleaved[i] * 0x7FFF, true);
            index += 2;
        }
        
        // our final binary blob
        var blob = new Blob ( [ view ], { type : 'audio/wav' } );
        
        // let's save it locally
        var url = (window.URL || window.webkitURL).createObjectURL(blob);
        var link = window.document.createElement('a');
        link.href = url;
        link.download = 'recording.wav';
        var click = document.createEvent("Event");
        click.initEvent("click", true, true);
        link.dispatchEvent(click);
    }

// -----------------------------------------------------------------------------
// interleave function. Takes the left and right channels and combines them
// into one array, alternating between the two channels to copy the values over.

    function interleave(leftChannel, rightChannel) {
        var length = leftChannel.length + rightChannel.length;
        var result = new Float32Array(length);

        var inputIndex = 0;

        for (var index = 0; index < length; ){
        result[index++] = leftChannel[inputIndex];
        result[index++] = rightChannel[inputIndex];
        inputIndex++;
        }
        return result;
    }

// -----------------------------------------------------------------------------
// mergeBuffers function. Takes each of the individual channel buffers and
// combines them sequentially into one final result array, which has length
// equal to the given length of the recording.

    function mergeBuffers(channelBuffer, recordingLength) {
        var result = new Float32Array(recordingLength);
        var offset = 0;
        var lng = channelBuffer.length;
        for (var i = 0; i < lng; i++){
            var buffer = channelBuffer[i];
            result.set(buffer, offset);
            offset += buffer.length;
        }
        return result;
    }

// -----------------------------------------------------------------------------
// writeUTFBytes function. Helper function for writeToWav.

    function writeUTFBytes(view, offset, string) {
        var lng = string.length;
        for (var i = 0; i < lng; i++){
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

// =============================================================================
// Test and Debugging Functions
// =============================================================================

// -----------------------------------------------------------------------------
// logData function. Logs time domain data, then frequency domain data for
// external analysis. Used as a debugging / quantitative analysis tool. If 
// needed, tie it to a button so problems can be logged in real time.

    this.logData = function() {
        var t, f;
        t = timeData;
        fft.forward(t);
        f = fft.spectrum;
        
        var i;
        var textToWrite = "";
        textToWrite += "------- Time Domain Data -------\n";
        for (i = 0; i < t.length; i++) {
            textToWrite += t[i] + "\n";
        }
        textToWrite += "\n------- Frequency Domain Data -------\n";
        for (i = 0; i < f.length; i++) {
            textToWrite += f[i] + "\n";
        }
        
        var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        var fileNameToSaveAs = "jslog.txt";

        var downloadLink = document.createElement("a");
        downloadLink.download = fileNameToSaveAs;
        downloadLink.innerHTML = "Download File";
        if (window.webkitURL !== null) {
            // Chrome allows the link to be clicked
            // without actually adding it to the DOM.
            downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        else {
            // Firefox requires the link to be added to the DOM
            // before it can be clicked.
            downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
            downloadLink.onclick = destroyClickedElement;
            downloadLink.style.display = "none";
            document.body.appendChild(downloadLink);
        }

        downloadLink.click();
    };

    // Helper for Firefox

    function destroyClickedElement(event) {
        document.body.removeChild(event.target);
    }
}
