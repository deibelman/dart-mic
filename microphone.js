/* =============================================================================

This code is released under the MIT Open Source License.

Copyright (c) 2013 Patrick Yukman and Max Deibel

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



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
    }

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
        procNode = context.createJavaScriptNode(BUFFER_LEN, 1, 1);
        procNode.onaudioprocess = function(e) {
            timeData = e.inputBuffer.getChannelData(0);
            if (recording) {
                leftChannel.push(new Float32Array(timeData));
                rightChannel.push(new Float32Array(timeData));
                recordingLength += BUFFER_LEN;
            }
        }
        
        // Create an audio source node from the microphone input to eventually 
        // feed into the processing node
        inputHardware = context.createMediaStreamSource(stream);
        procNode.connect(context.destination); // Node must have a destination
                                               // to work. Weird. 
        console.log('gotStream finished')                                      
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
		}

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
    }

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
    }
    
// -----------------------------------------------------------------------------
// startRecording function. Begins gathering microphone input and storing it in
// a WAV file.

    this.startRecording = function() {
        if (!initialized || !processing) {
            throw "Microphone not initialized / not processing"
        }
        else {
            console.log('Now recording');
            if (!recording) {
                recording = true;
            }
        }
    }

// -----------------------------------------------------------------------------
// stopRecording function. Stops packaging incoming microphone data into WAV
// file.

    this.stopRecording = function() {
        console.log('Done recording');
        if (recording) {
            recording = false;
            writeToWav();
        }
    }

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
            if (Math.abs(notes[key] - freq) <= Math.abs(notes[closest] - 
                    freq)) {
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
    }

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
    }
    
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
    }
    
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
    }

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
        var m1 = Math.abs(spctrm[maxIndex - 1]);
        var m2 = Math.abs(spctrm[maxIndex]);
        var m3 = Math.abs(spctrm[maxIndex + 1]);
        
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
        var currFreq = computeFreqFromFFT()
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
	    if (window.webkitURL != null) {
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
    }

    // Helper for Firefox

    function destroyClickedElement(event) {
	    document.body.removeChild(event.target);
    }
}

// ========================================================================== //
////////////////////////////////////////////////////////////////////////////////
// ========================================================================== //
//                                                                            //
//                              HERE BE DRAGONS                               //
//                          PROCEED AT YOUR OWN RISK                          //
//                                                                            //
// ========================================================================== //
////////////////////////////////////////////////////////////////////////////////
// ========================================================================== //

// DSP Library

/* 
 *  DSP.js - a comprehensive digital signal processing  library for javascript
 * 
 *  Created by Corban Brook <corbanbrook@gmail.com> on 2010-01-01.
 *  Copyright 2010 Corban Brook. All rights reserved.
 *
 */
 
/*Copyright (c) 2010 Corban Brook

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.*/



////////////////////////////////////////////////////////////////////////////////
//                                  CONSTANTS                                 //
////////////////////////////////////////////////////////////////////////////////

/**
 * DSP is an object which contains general purpose utility functions and constants
 */
var DSP = {
  // Channels
  LEFT:           0,
  RIGHT:          1,
  MIX:            2,

  // Waveforms
  SINE:           1,
  TRIANGLE:       2,
  SAW:            3,
  SQUARE:         4,

  // Filters
  LOWPASS:        0,
  HIGHPASS:       1,
  BANDPASS:       2,
  NOTCH:          3,

  // Window functions
  BARTLETT:       1,
  BARTLETTHANN:   2,
  BLACKMAN:       3,
  COSINE:         4,
  GAUSS:          5,
  HAMMING:        6,
  HANN:           7,
  LANCZOS:        8,
  RECTANGULAR:    9,
  TRIANGULAR:     10,

  // Loop modes
  OFF:            0,
  FW:             1,
  BW:             2,
  FWBW:           3,

  // Math
  TWO_PI:         2*Math.PI
};

// Setup arrays for platforms which do not support byte arrays
function setupTypedArray(name, fallback) {
  // check if TypedArray exists
  // typeof on Minefield and Chrome return function, typeof on Webkit returns object.
  if (typeof this[name] !== "function" && typeof this[name] !== "object") {
    // nope.. check if WebGLArray exists
    if (typeof this[fallback] === "function" && typeof this[fallback] !== "object") {
      this[name] = this[fallback];
    } else {
      // nope.. set as Native JS array
      this[name] = function(obj) {
        if (obj instanceof Array) {
          return obj;
        } else if (typeof obj === "number") {
          return new Array(obj);
        }
      };
    }
  }
}

setupTypedArray("Float32Array", "WebGLFloatArray");
setupTypedArray("Int32Array",   "WebGLIntArray");
setupTypedArray("Uint16Array",  "WebGLUnsignedShortArray");
setupTypedArray("Uint8Array",   "WebGLUnsignedByteArray");


////////////////////////////////////////////////////////////////////////////////
//                            DSP UTILITY FUNCTIONS                           //
////////////////////////////////////////////////////////////////////////////////

/**
 * Inverts the phase of a signal
 *
 * @param {Array} buffer A sample buffer
 *
 * @returns The inverted sample buffer
 */
DSP.invert = function(buffer) {
  for (var i = 0, len = buffer.length; i < len; i++) {
    buffer[i] *= -1;
  }

  return buffer;
};

/**
 * Converts split-stereo (dual mono) sample buffers into a stereo interleaved sample buffer
 *
 * @param {Array} left  A sample buffer
 * @param {Array} right A sample buffer
 *
 * @returns The stereo interleaved buffer
 */
DSP.interleave = function(left, right) {
  if (left.length !== right.length) {
    throw "Can not interleave. Channel lengths differ.";
  }
 
  var stereoInterleaved = new Float32Array(left.length * 2);
 
  for (var i = 0, len = left.length; i < len; i++) {
    stereoInterleaved[2*i]   = left[i];
    stereoInterleaved[2*i+1] = right[i];
  }
 
  return stereoInterleaved;
};

/**
 * Converts a stereo-interleaved sample buffer into split-stereo (dual mono) sample buffers
 *
 * @param {Array} buffer A stereo-interleaved sample buffer
 *
 * @returns an Array containing left and right channels
 */
DSP.deinterleave = (function() {
  var left, right, mix, deinterleaveChannel = []; 

  deinterleaveChannel[DSP.MIX] = function(buffer) {
    for (var i = 0, len = buffer.length/2; i < len; i++) {
      mix[i] = (buffer[2*i] + buffer[2*i+1]) / 2;
    }
    return mix;
  };

  deinterleaveChannel[DSP.LEFT] = function(buffer) {
    for (var i = 0, len = buffer.length/2; i < len; i++) {
      left[i]  = buffer[2*i];
    }
    return left;
  };

  deinterleaveChannel[DSP.RIGHT] = function(buffer) {
    for (var i = 0, len = buffer.length/2; i < len; i++) {
      right[i]  = buffer[2*i+1];
    }
    return right;
  };

  return function(channel, buffer) { 
    left  = left  || new Float32Array(buffer.length/2);
    right = right || new Float32Array(buffer.length/2);
    mix   = mix   || new Float32Array(buffer.length/2);

    if (buffer.length/2 !== left.length) {
      left  = new Float32Array(buffer.length/2);
      right = new Float32Array(buffer.length/2);
      mix   = new Float32Array(buffer.length/2);
    }

    return deinterleaveChannel[channel](buffer);
  };
}());

/**
 * Separates a channel from a stereo-interleaved sample buffer
 *
 * @param {Array}  buffer A stereo-interleaved sample buffer
 * @param {Number} channel A channel constant (LEFT, RIGHT, MIX)
 *
 * @returns an Array containing a signal mono sample buffer
 */
DSP.getChannel = DSP.deinterleave;

/**
 * Helper method (for Reverb) to mix two (interleaved) samplebuffers. It's possible
 * to negate the second buffer while mixing and to perform a volume correction
 * on the final signal.
 *
 * @param {Array} sampleBuffer1 Array containing Float values or a Float32Array
 * @param {Array} sampleBuffer2 Array containing Float values or a Float32Array
 * @param {Boolean} negate When true inverts/flips the audio signal
 * @param {Number} volumeCorrection When you add multiple sample buffers, use this to tame your signal ;)
 *
 * @returns A new Float32Array interleaved buffer.
 */
DSP.mixSampleBuffers = function(sampleBuffer1, sampleBuffer2, negate, volumeCorrection){
  var outputSamples = new Float32Array(sampleBuffer1);

  for(var i = 0; i<sampleBuffer1.length; i++){
    outputSamples[i] += (negate ? -sampleBuffer2[i] : sampleBuffer2[i]) / volumeCorrection;
  }
 
  return outputSamples;
}; 

// Biquad filter types
DSP.LPF = 0;                // H(s) = 1 / (s^2 + s/Q + 1)
DSP.HPF = 1;                // H(s) = s^2 / (s^2 + s/Q + 1)
DSP.BPF_CONSTANT_SKIRT = 2; // H(s) = s / (s^2 + s/Q + 1)  (constant skirt gain, peak gain = Q)
DSP.BPF_CONSTANT_PEAK = 3;  // H(s) = (s/Q) / (s^2 + s/Q + 1)      (constant 0 dB peak gain)
DSP.NOTCH = 4;              // H(s) = (s^2 + 1) / (s^2 + s/Q + 1)
DSP.APF = 5;                // H(s) = (s^2 - s/Q + 1) / (s^2 + s/Q + 1)
DSP.PEAKING_EQ = 6;         // H(s) = (s^2 + s*(A/Q) + 1) / (s^2 + s/(A*Q) + 1)
DSP.LOW_SHELF = 7;          // H(s) = A * (s^2 + (sqrt(A)/Q)*s + A)/(A*s^2 + (sqrt(A)/Q)*s + 1)
DSP.HIGH_SHELF = 8;         // H(s) = A * (A*s^2 + (sqrt(A)/Q)*s + 1)/(s^2 + (sqrt(A)/Q)*s + A)

// Biquad filter parameter types
DSP.Q = 1;
DSP.BW = 2; // SHARED with BACKWARDS LOOP MODE
DSP.S = 3;

// Find RMS of signal
DSP.RMS = function(buffer) {
  var total = 0;
  
  for (var i = 0, n = buffer.length; i < n; i++) {
    total += buffer[i] * buffer[i];
  }
  
  return Math.sqrt(total / n);
};

// Find Peak of signal
DSP.Peak = function(buffer) {
  var peak = 0;
  
  for (var i = 0, n = buffer.length; i < n; i++) {
    peak = (Math.abs(buffer[i]) > peak) ? Math.abs(buffer[i]) : peak; 
  }
  
  return peak;
};

// Fourier Transform Module used by DFT, FFT, RFFT
function FourierTransform(bufferSize, sampleRate) {
  this.bufferSize = bufferSize;
  this.sampleRate = sampleRate;
  this.bandwidth  = 2 / bufferSize * sampleRate / 2;

  this.spectrum   = new Float32Array(bufferSize/2);
  this.real       = new Float32Array(bufferSize);
  this.imag       = new Float32Array(bufferSize);

  this.peakBand   = 0;
  this.peak       = 0;

  /**
   * Calculates the *middle* frequency of an FFT band.
   *
   * @param {Number} index The index of the FFT band.
   *
   * @returns The middle frequency in Hz.
   */
  this.getBandFrequency = function(index) {
    return this.bandwidth * index + this.bandwidth / 2;
  };

  this.calculateSpectrum = function() {
    var spectrum  = this.spectrum,
        real      = this.real,
        imag      = this.imag,
        bSi       = 2 / this.bufferSize,
        sqrt      = Math.sqrt,
        rval, 
        ival,
        mag;

    for (var i = 0, N = bufferSize/2; i < N; i++) {
      rval = real[i];
      ival = imag[i];
      mag = bSi * sqrt(rval * rval + ival * ival);

      if (mag > this.peak) {
        this.peakBand = i;
        this.peak = mag;
      }

      spectrum[i] = mag;
    }
  };
}

/**
 * DFT is a class for calculating the Discrete Fourier Transform of a signal.
 *
 * @param {Number} bufferSize The size of the sample buffer to be computed
 * @param {Number} sampleRate The sampleRate of the buffer (eg. 44100)
 *
 * @constructor
 */
function DFT(bufferSize, sampleRate) {
  FourierTransform.call(this, bufferSize, sampleRate);

  var N = bufferSize/2 * bufferSize;
  var TWO_PI = 2 * Math.PI;

  this.sinTable = new Float32Array(N);
  this.cosTable = new Float32Array(N);

  for (var i = 0; i < N; i++) {
    this.sinTable[i] = Math.sin(i * TWO_PI / bufferSize);
    this.cosTable[i] = Math.cos(i * TWO_PI / bufferSize);
  }
}

/**
 * Performs a forward transform on the sample buffer.
 * Converts a time domain signal to frequency domain spectra.
 *
 * @param {Array} buffer The sample buffer
 *
 * @returns The frequency spectrum array
 */
DFT.prototype.forward = function(buffer) {
  var real = this.real, 
      imag = this.imag,
      rval,
      ival;

  for (var k = 0; k < this.bufferSize/2; k++) {
    rval = 0.0;
    ival = 0.0;

    for (var n = 0; n < buffer.length; n++) {
      rval += this.cosTable[k*n] * buffer[n];
      ival += this.sinTable[k*n] * buffer[n];
    }

    real[k] = rval;
    imag[k] = ival;
  }

  return this.calculateSpectrum();
};


/**
 * FFT is a class for calculating the Discrete Fourier Transform of a signal
 * with the Fast Fourier Transform algorithm.
 *
 * @param {Number} bufferSize The size of the sample buffer to be computed. Must be power of 2
 * @param {Number} sampleRate The sampleRate of the buffer (eg. 44100)
 *
 * @constructor
 */
function FFT(bufferSize, sampleRate) {
  FourierTransform.call(this, bufferSize, sampleRate);
   
  this.reverseTable = new Uint32Array(bufferSize);

  var limit = 1;
  var bit = bufferSize >> 1;

  var i;

  while (limit < bufferSize) {
    for (i = 0; i < limit; i++) {
      this.reverseTable[i + limit] = this.reverseTable[i] + bit;
    }

    limit = limit << 1;
    bit = bit >> 1;
  }

  this.sinTable = new Float32Array(bufferSize);
  this.cosTable = new Float32Array(bufferSize);

  for (i = 0; i < bufferSize; i++) {
    this.sinTable[i] = Math.sin(-Math.PI/i);
    this.cosTable[i] = Math.cos(-Math.PI/i);
  }
}

/**
 * Performs a forward transform on the sample buffer.
 * Converts a time domain signal to frequency domain spectra.
 *
 * @param {Array} buffer The sample buffer. Buffer Length must be power of 2
 *
 * @returns The frequency spectrum array
 */
FFT.prototype.forward = function(buffer) {
  // Locally scope variables for speed up
  var bufferSize      = this.bufferSize,
      cosTable        = this.cosTable,
      sinTable        = this.sinTable,
      reverseTable    = this.reverseTable,
      real            = this.real,
      imag            = this.imag,
      spectrum        = this.spectrum;

  var k = Math.floor(Math.log(bufferSize) / Math.LN2);

  if (Math.pow(2, k) !== bufferSize) { throw "Invalid buffer size, must be a power of 2."; }
  if (bufferSize !== buffer.length)  { throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + bufferSize + " Buffer Size: " + buffer.length; }

  var halfSize = 1,
      phaseShiftStepReal,
      phaseShiftStepImag,
      currentPhaseShiftReal,
      currentPhaseShiftImag,
      off,
      tr,
      ti,
      tmpReal,
      i;

  for (i = 0; i < bufferSize; i++) {
    real[i] = buffer[reverseTable[i]];
    imag[i] = 0;
  }

  while (halfSize < bufferSize) {
    //phaseShiftStepReal = Math.cos(-Math.PI/halfSize);
    //phaseShiftStepImag = Math.sin(-Math.PI/halfSize);
    phaseShiftStepReal = cosTable[halfSize];
    phaseShiftStepImag = sinTable[halfSize];
    
    currentPhaseShiftReal = 1;
    currentPhaseShiftImag = 0;

    for (var fftStep = 0; fftStep < halfSize; fftStep++) {
      i = fftStep;

      while (i < bufferSize) {
        off = i + halfSize;
        tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
        ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

        real[off] = real[i] - tr;
        imag[off] = imag[i] - ti;
        real[i] += tr;
        imag[i] += ti;

        i += halfSize << 1;
      }

      tmpReal = currentPhaseShiftReal;
      currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
      currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
    }

    halfSize = halfSize << 1;
  }

  return this.calculateSpectrum();
};

FFT.prototype.inverse = function(real, imag) {
  // Locally scope variables for speed up
  var bufferSize      = this.bufferSize,
      cosTable        = this.cosTable,
      sinTable        = this.sinTable,
      reverseTable    = this.reverseTable,
      spectrum        = this.spectrum;
     
      real = real || this.real;
      imag = imag || this.imag;

  var halfSize = 1,
      phaseShiftStepReal,
      phaseShiftStepImag,
      currentPhaseShiftReal,
      currentPhaseShiftImag,
      off,
      tr,
      ti,
      tmpReal,
      i;

  for (i = 0; i < bufferSize; i++) {
    imag[i] *= -1;
  }

  var revReal = new Float32Array(bufferSize);
  var revImag = new Float32Array(bufferSize);
 
  for (i = 0; i < real.length; i++) {
    revReal[i] = real[reverseTable[i]];
    revImag[i] = imag[reverseTable[i]];
  }
 
  real = revReal;
  imag = revImag;

  while (halfSize < bufferSize) {
    phaseShiftStepReal = cosTable[halfSize];
    phaseShiftStepImag = sinTable[halfSize];
    currentPhaseShiftReal = 1;
    currentPhaseShiftImag = 0;

    for (var fftStep = 0; fftStep < halfSize; fftStep++) {
      i = fftStep;

      while (i < bufferSize) {
        off = i + halfSize;
        tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
        ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

        real[off] = real[i] - tr;
        imag[off] = imag[i] - ti;
        real[i] += tr;
        imag[i] += ti;

        i += halfSize << 1;
      }

      tmpReal = currentPhaseShiftReal;
      currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
      currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
    }

    halfSize = halfSize << 1;
  }

  var buffer = new Float32Array(bufferSize); // this should be reused instead
  for (i = 0; i < bufferSize; i++) {
    buffer[i] = real[i] / bufferSize;
  }

  return buffer;
};

/**
 * RFFT is a class for calculating the Discrete Fourier Transform of a signal
 * with the Fast Fourier Transform algorithm.
 *
 * This method currently only contains a forward transform but is highly optimized.
 *
 * @param {Number} bufferSize The size of the sample buffer to be computed. Must be power of 2
 * @param {Number} sampleRate The sampleRate of the buffer (eg. 44100)
 *
 * @constructor
 */

// lookup tables don't really gain us any speed, but they do increase
// cache footprint, so don't use them in here

// also we don't use sepearate arrays for real/imaginary parts

// this one a little more than twice as fast as the one in FFT
// however I only did the forward transform

// the rest of this was translated from C, see http://www.jjj.de/fxt/
// this is the real split radix FFT

function RFFT(bufferSize, sampleRate) {
  FourierTransform.call(this, bufferSize, sampleRate);

  this.trans = new Float32Array(bufferSize);

  this.reverseTable = new Uint32Array(bufferSize);

  // don't use a lookup table to do the permute, use this instead
  this.reverseBinPermute = function (dest, source) {
    var bufferSize  = this.bufferSize, 
        halfSize    = bufferSize >>> 1, 
        nm1         = bufferSize - 1, 
        i = 1, r = 0, h;

    dest[0] = source[0];

    do {
      r += halfSize;
      dest[i] = source[r];
      dest[r] = source[i];
      
      i++;

      h = halfSize << 1;
      while (h = h >> 1, !((r ^= h) & h));

      if (r >= i) { 
        dest[i]     = source[r]; 
        dest[r]     = source[i];

        dest[nm1-i] = source[nm1-r]; 
        dest[nm1-r] = source[nm1-i];
      }
      i++;
    } while (i < halfSize);
    dest[nm1] = source[nm1];
  };

  this.generateReverseTable = function () {
    var bufferSize  = this.bufferSize, 
        halfSize    = bufferSize >>> 1, 
        nm1         = bufferSize - 1, 
        i = 1, r = 0, h;

    this.reverseTable[0] = 0;

    do {
      r += halfSize;
      
      this.reverseTable[i] = r;
      this.reverseTable[r] = i;

      i++;

      h = halfSize << 1;
      while (h = h >> 1, !((r ^= h) & h));

      if (r >= i) { 
        this.reverseTable[i] = r;
        this.reverseTable[r] = i;

        this.reverseTable[nm1-i] = nm1-r;
        this.reverseTable[nm1-r] = nm1-i;
      }
      i++;
    } while (i < halfSize);

    this.reverseTable[nm1] = nm1;
  };

  this.generateReverseTable();
}


// Ordering of output:
//
// trans[0]     = re[0] (==zero frequency, purely real)
// trans[1]     = re[1]
//             ...
// trans[n/2-1] = re[n/2-1]
// trans[n/2]   = re[n/2]    (==nyquist frequency, purely real)
//
// trans[n/2+1] = im[n/2-1]
// trans[n/2+2] = im[n/2-2]
//             ...
// trans[n-1]   = im[1] 

RFFT.prototype.forward = function(buffer) {
  var n         = this.bufferSize, 
      spectrum  = this.spectrum,
      x         = this.trans, 
      TWO_PI    = 2*Math.PI,
      sqrt      = Math.sqrt,
      i         = n >>> 1,
      bSi       = 2 / n,
      n2, n4, n8, nn, 
      t1, t2, t3, t4, 
      i1, i2, i3, i4, i5, i6, i7, i8, 
      st1, cc1, ss1, cc3, ss3,
      e, 
      a,
      rval, ival, mag; 

  this.reverseBinPermute(x, buffer);

  /*
  var reverseTable = this.reverseTable;

  for (var k = 0, len = reverseTable.length; k < len; k++) {
    x[k] = buffer[reverseTable[k]];
  }
  */

  for (var ix = 0, id = 4; ix < n; id *= 4) {
    for (var i0 = ix; i0 < n; i0 += id) {
      //sumdiff(x[i0], x[i0+1]); // {a, b}  <--| {a+b, a-b}
      st1 = x[i0] - x[i0+1];
      x[i0] += x[i0+1];
      x[i0+1] = st1;
    } 
    ix = 2*(id-1);
  }

  n2 = 2;
  nn = n >>> 1;

  while((nn = nn >>> 1)) {
    ix = 0;
    n2 = n2 << 1;
    id = n2 << 1;
    n4 = n2 >>> 2;
    n8 = n2 >>> 3;
    do {
      if(n4 !== 1) {
        for(i0 = ix; i0 < n; i0 += id) {
          i1 = i0;
          i2 = i1 + n4;
          i3 = i2 + n4;
          i4 = i3 + n4;
     
          //diffsum3_r(x[i3], x[i4], t1); // {a, b, s} <--| {a, b-a, a+b}
          t1 = x[i3] + x[i4];
          x[i4] -= x[i3];
          //sumdiff3(x[i1], t1, x[i3]);   // {a, b, d} <--| {a+b, b, a-b}
          x[i3] = x[i1] - t1; 
          x[i1] += t1;
     
          i1 += n8;
          i2 += n8;
          i3 += n8;
          i4 += n8;
         
          //sumdiff(x[i3], x[i4], t1, t2); // {s, d}  <--| {a+b, a-b}
          t1 = x[i3] + x[i4];
          t2 = x[i3] - x[i4];
         
          t1 = -t1 * Math.SQRT1_2;
          t2 *= Math.SQRT1_2;
     
          // sumdiff(t1, x[i2], x[i4], x[i3]); // {s, d}  <--| {a+b, a-b}
          st1 = x[i2];
          x[i4] = t1 + st1; 
          x[i3] = t1 - st1;
          
          //sumdiff3(x[i1], t2, x[i2]); // {a, b, d} <--| {a+b, b, a-b}
          x[i2] = x[i1] - t2;
          x[i1] += t2;
        }
      } else {
        for(i0 = ix; i0 < n; i0 += id) {
          i1 = i0;
          i2 = i1 + n4;
          i3 = i2 + n4;
          i4 = i3 + n4;
     
          //diffsum3_r(x[i3], x[i4], t1); // {a, b, s} <--| {a, b-a, a+b}
          t1 = x[i3] + x[i4]; 
          x[i4] -= x[i3];
          
          //sumdiff3(x[i1], t1, x[i3]);   // {a, b, d} <--| {a+b, b, a-b}
          x[i3] = x[i1] - t1; 
          x[i1] += t1;
        }
      }
   
      ix = (id << 1) - n2;
      id = id << 2;
    } while (ix < n);
 
    e = TWO_PI / n2;

    for (var j = 1; j < n8; j++) {
      a = j * e;
      ss1 = Math.sin(a);
      cc1 = Math.cos(a);

      //ss3 = sin(3*a); cc3 = cos(3*a);
      cc3 = 4*cc1*(cc1*cc1-0.75);
      ss3 = 4*ss1*(0.75-ss1*ss1);
   
      ix = 0; id = n2 << 1;
      do {
        for (i0 = ix; i0 < n; i0 += id) {
          i1 = i0 + j;
          i2 = i1 + n4;
          i3 = i2 + n4;
          i4 = i3 + n4;
       
          i5 = i0 + n4 - j;
          i6 = i5 + n4;
          i7 = i6 + n4;
          i8 = i7 + n4;
       
          //cmult(c, s, x, y, &u, &v)
          //cmult(cc1, ss1, x[i7], x[i3], t2, t1); // {u,v} <--| {x*c-y*s, x*s+y*c}
          t2 = x[i7]*cc1 - x[i3]*ss1; 
          t1 = x[i7]*ss1 + x[i3]*cc1;
          
          //cmult(cc3, ss3, x[i8], x[i4], t4, t3);
          t4 = x[i8]*cc3 - x[i4]*ss3; 
          t3 = x[i8]*ss3 + x[i4]*cc3;
       
          //sumdiff(t2, t4);   // {a, b} <--| {a+b, a-b}
          st1 = t2 - t4;
          t2 += t4;
          t4 = st1;
          
          //sumdiff(t2, x[i6], x[i8], x[i3]); // {s, d}  <--| {a+b, a-b}
          //st1 = x[i6]; x[i8] = t2 + st1; x[i3] = t2 - st1;
          x[i8] = t2 + x[i6]; 
          x[i3] = t2 - x[i6];
         
          //sumdiff_r(t1, t3); // {a, b} <--| {a+b, b-a}
          st1 = t3 - t1;
          t1 += t3;
          t3 = st1;
          
          //sumdiff(t3, x[i2], x[i4], x[i7]); // {s, d}  <--| {a+b, a-b}
          //st1 = x[i2]; x[i4] = t3 + st1; x[i7] = t3 - st1;
          x[i4] = t3 + x[i2]; 
          x[i7] = t3 - x[i2];
         
          //sumdiff3(x[i1], t1, x[i6]);   // {a, b, d} <--| {a+b, b, a-b}
          x[i6] = x[i1] - t1; 
          x[i1] += t1;
          
          //diffsum3_r(t4, x[i5], x[i2]); // {a, b, s} <--| {a, b-a, a+b}
          x[i2] = t4 + x[i5]; 
          x[i5] -= t4;
        }
     
        ix = (id << 1) - n2;
        id = id << 2;
   
      } while (ix < n);
    }
  }

  while (--i) {
    rval = x[i];
    ival = x[n-i-1];
    mag = bSi * sqrt(rval * rval + ival * ival);

    if (mag > this.peak) {
      this.peakBand = i;
      this.peak = mag;
    }

    spectrum[i] = mag;
  }

  spectrum[0] = bSi * x[0];

  return spectrum;
};
