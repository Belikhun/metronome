
(async () => {
	window.DEBUG = true;

	await metronome.init(app, {
		scale: 80
	});

	// await metronome.load("/Let Me Go.mp3");
	// metronome.bpm = 170;
	// metronome.offset = 0.177;

	await metronome.load("/Viva Happy.mp3");
	metronome.bpm = 148;
	metronome.offset = -0.02;

	// await metronome.load("/Artificial Snow.mp3");
	// metronome.bpm = 256;
	// metronome.offset = 1.416;

	// await metronome.load("/test60.mp3");
	// metronome.bpm = 60;
	// metronome.offset = 0.130;

	// await metronome.load("/metro_170bpm_5min.mp3");
	// metronome.bpm = 170;
})();