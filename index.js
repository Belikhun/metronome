
(async () => {
	window.DEBUG = true;

	await metronome.init(app);
	await metronome.load(new Audio("Let Me Go.mp3"));
	metronome.bpm = 170;
	metronome.offset = 0.528;
})();