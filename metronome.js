
const metronome = {
	/** @type {TreeDOM} */
	timeline: undefined,

	/** @type {TreeDOM} */
	view: undefined,
	
	/** @type {TreeDOM} */
	meters: undefined,
	
	/** @type {TreeDOM} */
	wavesPanel: undefined,
	
	/** @type {TreeDOM} */
	timingPanel: undefined,

	METER_MIN: -69,
	METER_MAX: 5,
	METER_STEP: 5,
	METER_LINE: 10,
	METER_UPDATE: 60,
	meterLastUpdate: 0,

	tickScale: 80,

	currentSwingRotate: 0,
	currentBPM: 0,
	currentOffset: 0,
	currentTime: 0,

	currentTick: -1,
	currentSwingTick: -1,
	timePerBeat: 1,
	timelineWidth: 0,

	/** @type {Animator} */
	swingAnimator: undefined,

	updateRequest: undefined,
	reUpdate: false,
	alternate: false,
	playing: false,

	/** @type {HTMLElement[]} */
	tickBars: [],

	audio: {
		/** @type {HTMLAudioElement} */
		instance: undefined,

		/** @type {AudioContext} */
		context: undefined,

		/** @type {ChannelSplitterNode} */
		splitter: undefined,

		/** @type {AnalyserNode} */
		left: undefined,

		/** @type {AnalyserNode} */
		right: undefined,

		/** @type {Uint8Array} */
		leftData: undefined,

		/** @type {Uint8Array} */
		rightData: undefined,

		leftMax: 0,
		rightMax: 0,

		duration: 0,
	},
	
	sounds: {
		/** @type {HTMLAudioElement} */
		latch: "sounds/latch.mp3",

		/** @type {HTMLAudioElement} */
		tickDownbeat: "sounds/tick-downbeat.mp3",

		/** @type {HTMLAudioElement} */
		tick: "sounds/tick.mp3"
	},

	/**
	 * Initialize metronome inside this container
	 * @param	{HTMLElement}	container
	 */
	async init(container) {
		this.timeline = makeTree("div", "timeline", {
			timer: { tag: "span", class: "timer", child: {
				time: { tag: "div", class: "time", child: {
					// Ugly hack to prevent creating alot of nodes
					// and make font look fixed-width
					m1: { tag: "span", text: "0" },
					m2: { tag: "span", text: "0" },
					sep1: { tag: "sep", text: ":" },
					s1: { tag: "span", text: "0" },
					s2: { tag: "span", text: "0" },
					sep2: { tag: "sep", text: ":" },
					ms1: { tag: "span", text: "0" },
					ms2: { tag: "span", text: "0" },
					ms3: { tag: "span", text: "0" }
				}},

				bpm: { tag: "div", class: "bpm", text: "0 BPM" }
			}},

			graph: { tag: "span", class: "graph", child: {
				inner: { tag: "div", class: "inner", child: {
					preview: { tag: "div", class: "preview" },
					ticks: { tag: "div", class: "ticks" },
				}},

				cursor: { tag: "img", class: "cursor", src: "parts/timeCursor.svg" }
			}},

			play: { tag: "span", class: ["button", "play"] },
			stop: { tag: "span", class: ["button", "stop"] }
		});

		this.meters = makeTree("div", "meters", {
			ruler: { tag: "div", class: "ruler" },

			left: { tag: "div", class: ["channel", "left"], child: {
				label: { tag: "span", class: "label", text: "L" },
				value: { tag: "span", class: "value", text: "? db" },
				bar: { tag: "div", class: "bar" },
				clip: { tag: "span", class: "clip" },
				max: { tag: "span", class: "max" }
			}},

			right: { tag: "div", class: ["channel", "right"], child: {
				label: { tag: "span", class: "label", text: "R" },
				value: { tag: "span", class: "value", text: "? db" },
				bar: { tag: "div", class: "bar" },
				clip: { tag: "span", class: "clip" },
				max: { tag: "span", class: "max" }
			}},

			label: { tag: "div", class: "label", text: "VOLUME METERS" }
		});

		this.wavesPanel = makeTree("div", "waves", {

		});

		this.timingPanel = makeTree("div", "timing", {
			top: { tag: "div", class: "top", child: {
				metronome: { tag: "div", class: "metronome", child: {
					body: { tag: "img", class: "body", src: "parts/body.svg" },

					swing: { tag: "div", class: "swing", child: {
						stick: { tag: "div", class: "stick" },
						weight: { tag: "img", class: "weight", src: "parts/weight.svg" }
					}},

					pin: { tag: "div", class: "pin" },
					lock: { tag: "img", class: "lock", src: "parts/lockingWedge.svg" },
					cover: { tag: "img", class: "cover", src: "parts/cover.svg" },
					value: { tag: "span", class: "value", text: "000" }
				}}
			}}
		});

		this.view = makeTree("div", "view", {
			meters: this.meters,

			panels: { tag: "span", class: "panels", child: {
				waves: this.wavesPanel,
				timing: this.timingPanel
			}}
		});

		container.classList.add("MetronomeContainer");
		container.append(this.timeline, this.view);

		this.timeline.play.addEventListener("click", () => this.toggle());
		this.timeline.stop.addEventListener("click", () => this.stop());

		// Init
		this.meters.style.setProperty("--rate", `${this.METER_UPDATE}ms`);
		this.initMeterRuler();
		this.bpm = 60;

		await this.initSounds();
	},

	initMeterRuler() {
		emptyNode(this.meters.ruler);
		let total = this.METER_MAX - this.METER_MIN;

		// Generate ruler
		for (let i = this.METER_MIN; i <= this.METER_MAX; i += 1) {
			let node = document.createElement("div");
			node.style.bottom = `${(Math.abs(i - this.METER_MIN) / total) * 100}%`;
			
			if (i % this.METER_STEP === 0) {
				node.innerText = i;
				node.classList.add("step");
			}

			if (i % this.METER_LINE === 0)
				node.classList.add("line");

			this.meters.ruler.appendChild(node);
		}
	},

	async initSounds() {
		let promises = []

		for (let [key, value] of Object.entries(this.sounds)) {
			let rl, el;

			promises.push(new Promise((resolve, reject) => {
				this.sounds[key] = new Audio(value);

				this.sounds[key].addEventListener("error", el = (e) => {
					clog("ERRR", `Error loading sound: ${value}`, e);
					reject({ code: -1, description: `Cannot load sound ${value}`, data: e });
				});

				this.sounds[key].addEventListener("canplaythrough", rl = () => {
					clog("OKAY", `Loaded sound ${value}`);
					this.sounds[key].removeEventListener("canplaythrough", rl);
					this.sounds[key].removeEventListener("error", el);
					resolve();
				});
			}));
		}

		await Promise.all(promises);
	},

	/**
	 * Play a sound
	 * @param	{HTMLAudioElement}	sound 
	 */
	playSound(sound) {
		if (!sound.paused) {
			// Clone and play
			sound.cloneNode().play();
			return;
		}

		sound.play();
	},

	/**
	 * Prepare a audio file
	 * @param	{HTMLAudioElement}		audio
	 */
	async load(audio) {
		// Check audio not fully loaded
		if (audio.readyState < 4) {
			clog("INFO", "Audio is not fully loaded, wait for it to fully load...");

			await new Promise((resolve) => {
				clog("OKAY", "Audio loaded.");
				audio.addEventListener("canplaythrough", () => resolve());
			});
		}

		this.audio.instance = audio;
		this.audio.duration = audio.duration;
		this.renderTicks();

		this.audio.context = undefined;
		this.reset();
	},

	audioInit() {
		this.audio.context = new AudioContext();
		this.audio.splitter = this.audio.context.createChannelSplitter(2);
		this.audio.left = this.audio.context.createAnalyser();
		this.audio.right = this.audio.context.createAnalyser();

		this.audio.left.fftSize = 64;
		this.audio.right.fftSize = 64;

		this.audio.leftData = new Float32Array(this.audio.left.frequencyBinCount);
		this.audio.rightData = new Float32Array(this.audio.right.frequencyBinCount);
		
		let source = this.audio.context.createMediaElementSource(this.audio.instance);
		this.audio.splitter.connect(this.audio.left, 0, 0);
		this.audio.splitter.connect(this.audio.right, 1, 0);
		source.connect(this.audio.splitter);
		source.connect(this.audio.context.destination);
	},

	play() {
		if (!this.audio.instance)
			return;

		// Only init audio features after user interaction.
		if (!this.audio.context)
			this.audioInit();

		this.playing = true;
		this.timeline.play.classList.add("pause");
		this.audio.instance.play();
		this.startUpdate();
	},

	pause() {
		if (!this.audio.instance)
			return;

		this.playing = false;
		this.timeline.play.classList.remove("pause");
		this.audio.instance.pause();
		this.stopUpdate();
		this.swing(this.timePerBeat, "latch");
	},

	toggle() {
		if (this.playing)
			this.pause();
		else
			this.play();
	},

	stop() {
		this.pause();
		this.audio.instance.currentTime = 0;
		this.time = 0;
		this.reset();
	},

	reset() {
		this.currentTick = -1;
	},

	startUpdate() {
		cancelAnimationFrame(this.updateRequest);
		this.reUpdate = true;
		this.update();
	},

	stopUpdate() {
		this.reUpdate = false;
		cancelAnimationFrame(this.updateRequest);
	},

	/**
	 * Main update function that update every frame.
	 * @return	{any}
	 */
	update() {
		this.time = this.audio.instance.currentTime;

		let now = performance.now();
		let oTime = this.time - this.offset;
		let tick = (oTime / this.timePerBeat);

		// Only update beat when we are out of offset
		// time.
		if (oTime > 0) {
			// Swing tick have a little offset.
			let sTick = (oTime + (this.timePerBeat * 0.5)) / this.timePerBeat;
	
			if (sTick > (this.currentSwingTick + 1)) {
				this.currentSwingTick = Math.floor(sTick);
				this.swing(this.timePerBeat, this.currentSwingTick);
			}

			if (tick > (this.currentTick + 1)) {
				this.currentTick = Math.floor(tick);
				clog("DEBG", "tick", this.currentTick);
			}
		}

		// Update left right data
		if (now - this.meterLastUpdate > this.METER_UPDATE) {
			this.updateChannelMeter("left");
			this.updateChannelMeter("right");
			this.meterLastUpdate = now;
		}

		if (this.alternate) {
			// Alternate frame.
		}

		this.alternate = !this.alternate;

		if (this.audio.instance.paused) {
			clog("INFO", "Playback ended, stopped updating");
			this.stopUpdate();
			this.time = this.audio.duration;
			return;
		}

		if (this.reUpdate)
			this.updateRequest = requestAnimationFrame(() => this.update());
	},

	renderTicks() {
		let ticks = Math.floor((this.audio.duration - this.offset) / this.timePerBeat);
		
		this.timelineWidth = this.tickScale * ticks;
		this.timeline.graph.inner.ticks.style.width = `${this.timelineWidth}px`;
		clog("DEBG", `maxTick = ${ticks}`);

		for (let tick = 0; tick < ticks; tick++) {
			if (!this.tickBars[tick]) {
				this.tickBars[tick] = document.createElement("div");

				if (tick % 4 === 0)
					this.tickBars[tick].classList.add("downbeat");

				this.timeline.graph.inner.ticks.appendChild(this.tickBars[tick]);
			}

			this.tickBars[tick].style.left = `${this.tickScale * tick}px`;
		}
	},

	/**
	 * Update meter for specified channel
	 * @param	{"left" | "right"}	channel 
	 */
	updateChannelMeter(channel) {
		let analyzer = this.audio[channel];
		analyzer.getFloatTimeDomainData(channel === "left"
			? this.audio.leftData
			: this.audio.rightData);

		let data = channel === "left" ? this.audio.leftData : this.audio.rightData;
		let sum = 0;

		for (let amplitude of data)
			sum += amplitude * amplitude;

		let value = Math.sqrt(sum / data.length);
		let db = 10 * Math.log(value) * Math.LOG10E;
		value = scaleValue(db, [this.METER_MIN, this.METER_MAX], [0, 100]);
		this.meters[channel].bar.style.height = `${value}%`;
		this.meters[channel].value.innerText = `${db.toFixed(2)} db`;

		if (this.audio[`${channel}Max`] < value) {
			this.audio[`${channel}Max`] = value;
			this.meters[channel].max.style.bottom = `${value}%`;
		}
	},

	/**
	 * Swing back and forth by specified duration.
	 * @param	{Number}			duration
	 * @param	{Number | "latch"}	tick
	 */
	swing(duration, tick) {
		if (this.swingAnimator)
			this.swingAnimator.cancel();

		let start = this.currentSwingRotate;
		let toLeft = (start <= 0);
		let target = (tick === "latch") ? 0 : (toLeft ? 30 : -30);
		let amount = target - start;

		let soundPlayed = false;
		this.timingPanel.top.metronome.swing.classList.remove("beat");
		this.timingPanel.top.metronome.swing.style
			.setProperty("--duration", `${duration * 0.8}s`);

		this.swingAnimator = new Animator(duration, Easing.InOutQuart, (t) => {
			this.swingRotate = start + (amount * t);

			if (!soundPlayed
				&& ((toLeft && this.swingRotate >= 0)
				|| (!toLeft && this.swingRotate <= 0))) {

				if (tick === "latch") {
					if (t === 1)
						this.playSound(this.sounds.latch);
				} else {
					// Play tick sound
					if (tick % 4 === 0)
						this.playSound(this.sounds.tickDownbeat);
					else
						this.playSound(this.sounds.tick);
	
					this.timingPanel.top.metronome.swing.classList.add("beat");
				}

				soundPlayed = true;
			}
		});
	},

	/**
	 * Set swing stick rotation angle
	 * @param	{Number}	deg
	 */
	set swingRotate(deg) {
		this.currentSwingRotate = deg;
		this.timingPanel.top.metronome.swing.style.transform = `rotate(${deg}deg)`;
	},

	get swingRotate() {
		return this.currentSwingRotate;
	},

	/**
	 * Set bpm
	 * @param	{Number}	bpm
	 */
	set bpm(bpm) {
		if (bpm <= 0)
			bpm = 1;

		let weightPos = scaleValue(bpm, [0, 500], [6, 76]);
		this.currentBPM = bpm;
		this.timingPanel.top.metronome.swing.weight.style.top = `${weightPos}%`;
		this.timingPanel.top.metronome.value.innerText = bpm;
		this.timeline.timer.bpm.innerText = `${bpm} BPM`;
		this.timePerBeat = 60 / bpm;
		this.renderTicks();
	},

	/**
	 * Set timing offset
	 * @param	{Number}	offset
	 */
	set offset(offset) {
		this.currentOffset = offset;
		let offsetWidth = (this.tickScale / this.timePerBeat) * offset;
		clog("DEBG", `offsetWidth = ${offsetWidth}`);
		this.timeline.graph.inner.ticks.style.marginLeft = `${offsetWidth}px`;
	},

	get offset() {
		return this.currentOffset;
	},

	/**
	 * Set current time
	 * @param	{Number}	currentTime
	 */
	set time(currentTime) {
		let pt = parseTime(currentTime, { msDigit: 3 });
		let progress = (currentTime / this.audio.duration);

		// I wish this font is fixed-width so I don't have
		// to do this ugly hack...
		this.timeline.timer.time.m1.innerText = pt.m > 10 ? `${pt.m}`[0] : "0";
		this.timeline.timer.time.m2.innerText = pt.m % 10;
		this.timeline.timer.time.s1.innerText = pt.s > 10 ? `${pt.s}`[0] : "0";
		this.timeline.timer.time.s2.innerText = pt.s % 10;
		this.timeline.timer.time.ms1.innerText = pt.ms[0];
		this.timeline.timer.time.ms2.innerText = pt.ms[1];
		this.timeline.timer.time.ms3.innerText = pt.ms[2];

		this.timeline.graph.inner.style.transform = `translateX(-${progress * this.timelineWidth}px)`;
		this.currentTime = currentTime;
	},

	get time() {
		return this.currentTime;
	}
}