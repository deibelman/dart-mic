% Assume Autocorrelate and FFT are already initialized column vectors
close all

xs = linspace(0, (length(Autocorrelate)-1)*(1024/44100), length(Autocorrelate));

figure;
subplot(2,1,1);
plot(xs, Autocorrelate);
title({'Frequency Output from Autocorrelation Method.'...
    'File = cdefgfedcgegc.mp3'});
xlabel('Time (seconds)');
ylabel('Frequency (Hz)');
grid on;

subplot(2,1,2);
plot(xs, FFT);
title({'Frequency Output from Fast Fourier Transform Method.'...
    'File = cdefgfedcgegc.mp3'});
xlabel('Time (seconds)');
ylabel('Frequency (Hz)');
grid on;

%{
subplot(3,1,3);
plot(xs, Autocorrelate, xs, FFT);
title('Autocorrelate plotted against FFT');
xlabel('Time (seconds)');
ylabel('Frequency (Hz)');
grid on;
%}