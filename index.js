
(async () => {
	window.DEBUG = true;

	await metronome.init(app, {
		scale: 80
	});

	await metronome.load("/Let Me Go.mp3");
	metronome.bpm = 170;
	metronome.time = 160;
	metronome.offset = 0.528;

	// await metronome.load("/Viva Happy.mp3");
	// metronome.bpm = 148;
	// metronome.offset = -0.02;
	// metronome.time = 200;

	// await metronome.load("/test60.mp3");
	// metronome.bpm = 60;
	// metronome.offset = 0.130;
	// metronome.time = 6*60 + 55;
})();