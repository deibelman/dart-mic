# dart-mic


## Who are we?

We are Max Deibel (@mdeibel, deibel.max@gmail.com) and Patrick Yukman 
(@pyukman, contact@patrickyukman.com). We created this library as a stand-alone project, 
but it was motivated by our work on our senior project at Dartmouth College: 
VoxTrainer.

## About the library

This is a Javascript library which listens to microphone input and performs 
pitch/note detection, volume detection, recording, and general purpose data 
processing. It makes use of the Web Audio APi (which is only supported by Chrome
currently) and DSP.js.

To view a website with a simple demo of our project, please visit here:
[DEMO](http://deibelman.github.io/dart-mic/)

## General Usage

1. Create Microphone object (`var mic = new Microphone();`).
2. Any function defined below as 
	```javascript
    this.foo = function(params) { ... }
    ```
    can then be called via the Microphone object.
	 Example:
     ```javascript
     mic.foo(param);
     ```
     
## Function list (see "Function Descriptions" for more details)

### Microphone Setup
| Callable functions    | Helper Functions |
| --------------------- | ---------------- |
| `this.initialize`     | `gotStream`      |
| `this.isInitialized`  | `noStream`       |
| `this.startListening` |
| `this.stopListening`  | 
| `this.startRecording` |
| `this.stopRecording`  |

   
### General Purpose
| Callable functions          | Helper Functions |
| --------------------------- | ---------------- |
| `this.getMaxInputAmplitude` | `matchNote`      |
| `this.getFreq`              |
| `this.getNote`              |
| `this.getNoteCents`         |

### Autocorrelation
| Callable functions         | Helper Functions |
| -------------------------- | ---------------- |
| `autocorrelate`            |
| `getPeakPeriodicity`       |
| `computeFreqFromAutocorr`  |
| `getNoteFromAutocorr`      |
| `getNoteCentsFromAutocorr` |

### FFT
| Callable functions | Helper Functions         |
| ------------------ | ------------------------ |
|                    | `computeFreqFromFFT`     |
|                    | `jainsMethodInterpolate` |
|                    | `getNoteFromFFT`         |
|                    | `getNoteCentsFromFFT`    |

### Recording
| Callable functions | Helper Functions |
| ------------------ | ---------------- |
|                    | `writeToWav`     |
|                    | `interleave`     |
|                    | `mergeBuffers`   |
|                    | `writeUTFBytes`  |

### Testing and Debugging
| Callable Functions | Helper Functions        |
| ------------------ | ----------------------- |
| `this.logData`     | `destroyClickedElement` |


## Function descriptions


### Microphone Setup Functions
`this.initialize`
Properly initializes the parameters of a Microphone 
 object, defines the frequency-->note lookup table, and calls `getUserMedia`
 to request browser-level access to a user's microphone. In general, do not
 change any part of this initialize function without a compelling reason.
**Example:** `mic.initialize()`

`this.isInitialized`
This function simply returns whether or not the 
 microphone object has been fully initialized (indicated by the var 
 `initialized` being equal to true. Returns a boolean value.
 **Example:** `if (mic.isInitialized()) { ... }`

`this.startListening`
Connects the microphone input to a processing node
 for future operations. Throws an error if the microphone hasn't been
 initialized before this function is called -- in other words, if a user
 tries to get mic data before allowing the browser permission to collect it.
**Example:** `mic.startListening()`

`this.stopListening`
Disconnects the microphone input. Can be called or
 tied to a button to save on processing.
**Example:** `mic.stopListening()`

`this.startRecording`
Begins gathering microphone input and storing it in a WAV file.
**Example:** `mic.startRecording()`

`this.stopRecording`
Stops packaging incoming microphone data into WAV file.
**Example:** `mic.stopRecording()`

`gotStream`
This function is the success callback for `getUserMedia`
 and initializes the Web Audio API / DSP.JS structures that allow us to
 manipulate the data streaming in off the microphone.

`noStream`
This function is the failure callback for `getUserMedia`
 and alerts the user if their browser doesn't support `getUserMedia`.

### General purpose functions
`this.getMaxInputAmplitude`
Input: none. Output: the amplitude of the
 microphone signal, expressed in decibels (scaled from -120). Gives an idea
 of the volume of the sound picked up by the microphone.
**Example:** `mic.getMaxInputAmplitude()`

`this.getFreq`
Input: the method number (default is 1 to use
autocorrelation, 2 to use FFT). Output: the detected frequency calculated via
 the selected method.
 **Example:** `mic.getFreq(1)` returns frequency calculated via autocorrelation

`this.getNote`
Input: the method number (default is 1 to use
 autocorrelation, 2 to use FFT). Output: the detected note calculated via
 the selected method.
**Example:** `mic.getNote(1)` returns note calculated via autocorrelation

`this.getNoteCents`
Input: the method number (default is 1 to use
 autocorrelation, 2 to use FFT). Output: the detected note cents offset 
 calculated via the selected method.
**Example:** `mic.getNoteCents(2)` returns note cents offset calculated via FFT

`matchNote`
Input: frequency, in Hertz. Output: closest note 
 value to that frequency. This function iterates over the JSON lookup table
 to find the nearest note to the input frequency and returns the note as a
 string.

### Autocorrelation functions
`autocorrelate`
For each index in an array of length `BUFFER_LEN`,
 adds the data element at that index and the next index together, then stores
 it in a separate sums array.

`getPeakPeriodicityIndex`
After finding the second zero crossing
 in the passed sums array, finds the max peak that occcurs after that crossing

`computeFreqFromAutocorr`
Gets the max peak index, and then 
 calculates the frequency by dividing the sample rate by that index.

`getNoteFromAutocorr`
Computes the current frequency with 
 `computeFreqFromAutoCorr`, then determines the current note by feeding the 
 current frequency to `matchNote`.

`getNoteCentsFromAutocorr`
Computes the current frequency with 
 `computeFreqFromAutocorr`, then determines the current note by feeding the 
 current frequency to `matchNote`, and finally computes the cents offset from 
 the current note.

### FFT functions
`computeFreqFromFFT`
Input: none. Output: frequency of the sound 
 picked up by the microphone, computed via FFT. Automatically grabs the 
 current microphone data from the `timeData` global variable and uses the FFT
 defined in DSP.JS. Interpolates the FFT power spectrum to more accurately
 guess the actual value of the peak frequency of the signal.

`jainsMethodInterpolate`
Input: array of spectrum power values 
 returned from FFT; index of bin in spectrum array with max power value.
 Output: a fractional bin number indicating the interpolated location of
 the actual signal peak frequency. Uses neighbouring indices to the index of 
 greatest magnitude to create a more accurate estimate of the frequency. 
 Simply multiply the returned fractional bin index by the FFT spectrum 
 frequency resolution to get the estimate of the actual peak frequency.

`getNoteFromFFT`
Computes the current frequency with 
 `computeFreqFromFFT`, then determines the current note by feeding the current
 frequency to `matchNote`.

`getNoteCentsFromFFT`
Computes the current frequency with 
 `computeFreqFromFFT`, then determines the current note by feeding the current
 frequency to `matchNote`, and finally computes the cents offset from the 
 current note.

### Recording functions
`writeToWav`
Writes our recording data to a .WAV file.

`interleave`
Takes the left and right channels and combines them
 into one array, alternating between the two channels to copy the values over.

`mergeBuffers`
Takes each of the individual channel buffers and
 combines them sequentially into one final result array, which has length
 equal to the given length of the recording.

`writeUTFBytes`
Helper function for `writeToWav`.

### Test and debugging functions
`this.logData`
Logs time domain data, then frequency domain data for
 external analysis. Used as a debugging / quantitative analysis tool. If 
 needed, tie it to a button so problems can be logged in real time.
**Example:** `mic.logData()` will log time and frequency domain data in txt file

---
## License Information
**See LICENSE**