
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

	SAMPLE_PER_SEC: 120,

	METER_MIN: -69,
	METER_MAX: 5,
	METER_STEP: 5,
	METER_LINE: 10,
	METER_UPDATE: 20,
	meterLastUpdate: 0,

	/** Pixels per tick */
	tickScale: 80,
	pxPerSecond: 1,

	currentSwingRotate: 0,
	currentBPM: 0,
	currentOffset: 0,
	currentTime: 0,

	currentTick: -1,
	timePerBeat: 1,
	timelineWidth: 0,

	/** @type {Animator} */
	swingAnimator: undefined,

	updateRequest: undefined,
	reUpdate: false,
	alternate: false,
	playing: false,
	swingLeft: true,

	/** @type {HTMLElement[]} */
	tickBars: [],

	/**
	 * @typedef {{
	 * 	tick: Number
	 * 	node: HTMLElement
	 * 	canvas: HTMLCanvasElement
	 * 	update: Boolean
	 * }} ComparatorNode
	 * @type {ComparatorNode[]} */
	comparators: [],
	comparatorCurrentFrom: undefined,
	comparatorCurrentTo: undefined,
	comparatorCurrentTick: undefined,

	COMPARATOR_TICKS: 8,
	COMPARATOR_SIZE: 300,

	audio: {
		/** @type {HTMLAudioElement} */
		instance: undefined,

		/** @type {AudioBuffer} */
		buffer: undefined,

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

		points: [],

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
	 * @param	{Object}		options
	 * @param	{Number}		options.bpm			Beat per minute
	 * @param	{Number}		options.scale		Timeline scale (pixels per beat)
	 */
	async init(container, {
		bpm = 60,
		scale = 80
	} = {}) {
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
				preview: { tag: "canvas", class: "preview" },
				inner: { tag: "div", class: "inner", child: {
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
				}},

				comparator: { tag: "div", class: "comparator" }
			}}
		});

		this.view = makeTree("div", "view", {
			meters: this.meters,

			panels: { tag: "span", class: "panels", child: {
				waves: this.wavesPanel,
				timing: this.timingPanel
			}}
		});

		this.timingPanel.top.comparator.style.width = `${this.COMPARATOR_SIZE}px`;
		this.timingPanel.top.comparator.style.height = `${this.COMPARATOR_SIZE}px`;
		container.classList.add("MetronomeContainer");
		container.append(this.timeline, this.view);

		this.timeline.play.addEventListener("click", () => this.toggle());
		this.timeline.stop.addEventListener("click", () => this.stop());

		// Init
		this.meters.style.setProperty("--rate", `${this.METER_UPDATE}ms`);
		this.initMeterRuler();
		this.bpm = bpm;
		this.scale = scale;

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
	 * @param	{String|File}	audio
	 */
	async load(audio) {
		this.audio.context = new AudioContext();

		if (typeof audio === "string") {
			let response = await fetch(audio);
			let clone = response.clone();
			this.audio.buffer = await this.audio.context.decodeAudioData(await response.arrayBuffer());
			this.audio.instance = new Audio(URL.createObjectURL(await clone.blob()));
		} else {
			this.audio.buffer = await this.audio.context.decodeAudioData(audio);
		}

		// Check audio not fully loaded
		if (this.audio.instance.readyState < 4) {
			clog("INFO", "Audio is not fully loaded, wait for it to fully load...");

			await new Promise((resolve) => {
				clog("OKAY", "Audio loaded.");
				this.audio.instance.addEventListener("canplaythrough", () => resolve());
			});
		}

		this.audio.duration = this.audio.instance.duration;

		this.sampleDataPoints();
		this.renderTicks();

		await this.audioInit();
		this.reset();

		this.time = 0;
		this.renderComparator(0);
	},

	async audioInit() {
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
	
	sampleDataPoints() {
		let start = performance.now();
		clog("DEBG", "sampling data points...");

		this.audio.points = [];
		let channels = this.audio.buffer.numberOfChannels > 1
			? [0, 1] : [0];

		for (let c of channels) {
			this.audio.points[c] = [];

			let raw = this.audio.buffer.getChannelData(c);
			let samples = Math.floor(this.SAMPLE_PER_SEC * this.audio.buffer.duration);
			const blockSize = Math.floor(raw.length / samples);
			
			for (let i = 0; i < samples; i++) {
				let blockStart = Math.floor((blockSize * i) - (blockSize / 2));
				blockStart = Math.max(blockStart, 0);
				let sum = 0;
	
				for (let j = 0; j < blockSize; j++)
					sum += Math.abs(raw[blockStart + j]);
	
				this.audio.points[c].push(sum / blockSize);
			}
	
			const multiplier = Math.pow(Math.max(...this.audio.points[c]), -1);
			this.audio.points[c] = this.audio.points[c].map(i => i * multiplier);
		}

		clog("DEBG", `sampling complete! took ${performance.now() - start}ms`);
	},

	/**
	 * Draw waveform onto canvas
	 * @param	{HTMLCanvasElement}			canvas
	 * @param	{Number}					from
	 * @param	{Number}					length
	 * @param	{Object}					options
	 * @param	{Number}					options.shift	Shift factor
	 * @param	{Number}					options.color	Wave color
	 * @param	{Number}					options.width	Canvas width
	 * @param	{Number}					options.height	Canvas height
	 */
	drawWaveform(canvas, from, length, {
		width = undefined,
		height = undefined,
		shift = 0,
		color = "#76d1ff"
	} = {}) {
		if (typeof width === "number")
			canvas.width = width;
		else
			width = canvas.width = canvas.clientWidth;
		
		if (typeof height === "number")
			canvas.height = height;
		else
			height = canvas.height = canvas.clientHeight;

		from -= (length / 2) * shift;
		length = length * (1 - shift);

		let ctx = canvas.getContext("2d");
		let start = from * this.SAMPLE_PER_SEC;
		let count = length * this.SAMPLE_PER_SEC;
		let fStart = Math.floor(start);
		let fCount = Math.ceil(count);
		let to = fStart + fCount;
		let data, x;

		ctx.clearRect(0, 0, width, height);
		
		ctx.fillStyle = color;
		
		if (this.audio.points[0]) {
			// Left channel on top
			ctx.beginPath();
			ctx.moveTo(0, height / 2 + 1);
	
			for (let i = fStart; i <= to; i++) {
				data = this.audio.points[0][i] || 0;
	
				if (data === 0)
					continue;
	
				x = (width / count) * (i - start);
				ctx.lineTo(x, (height / 2) * (1 - data));
			}
	
			// End left
			ctx.lineTo(width, height / 2 + 1);
			ctx.closePath();
			ctx.fill();
		}

		if (this.audio.points[1]) {
			// Right channel on bottom
			ctx.beginPath();
			ctx.moveTo(0, height / 2 - 1);
	
			for (let i = fStart; i <= to; i++) {
				data = this.audio.points[1][i] || 0;
	
				if (data === 0)
					continue;
	
				x = (width / count) * (i - start);
				ctx.lineTo(x, height - (height / 2) * (1 - data));
			}
	
			// End right
			ctx.lineTo(width, height / 2 - 1);
			ctx.closePath();
			ctx.fill();
		}
	},

	async play() {
		if (!this.audio.instance)
			return;

		if (this.audio.context.state === "suspended")
			await this.audio.context.resume();

		this.playing = true;
		this.timeline.play.classList.add("pause");
		await this.audio.instance.play();
		this.startUpdate();

		// Decrease current swing tick to re-calculate time to
		// next tick.
		this.currentSwingTick -= 1;
	},

	async pause() {
		if (!this.audio.instance)
			return;

		this.playing = false;
		this.timeline.play.classList.remove("pause");
		await this.audio.instance.pause();
		this.stopUpdate();
		this.swing(this.timePerBeat * 2, "latch");
	},

	async toggle() {
		if (this.playing)
			await this.pause();
		else
			await this.play();
	},

	async stop() {
		await this.pause();
		this.audio.instance.currentTime = 0;
		this.time = 0;
		this.renderComparator(0);
		this.reset();
	},

	completed() {
		clog("INFO", "Playback ended, stopped updating.");
		this.stopUpdate();
		this.time = this.audio.duration;
		this.swing(this.timePerBeat * 2, "latch");
		this.timeline.play.classList.remove("pause");
	},

	reset() {
		this.currentTick = -1;
	},

	startUpdate() {
		cancelAnimationFrame(this.updateRequest);
		this.reUpdate = true;
		this.reset();
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
		let tick = oTime / this.timePerBeat;

		if (oTime > -this.timePerBeat) {
			// Sudden timing change to main tick,
			// update current tick.
			if (Math.abs(tick - this.currentTick) >= 1.2)
				this.currentTick = Math.floor(tick) - 1;
	
			if (tick > (this.currentTick + 1)) {
				this.currentTick = Math.floor(tick);
				let nextTickTime = (this.currentTick + 1) * this.timePerBeat;
				let toNextTick = nextTickTime - oTime;
				let shouldTick = Math.abs(toNextTick - this.timePerBeat) < 0.05;
	
				clog("DEBG", "------ tick", this.currentTick, `nextTickTime = ${nextTickTime}`, `toNextTick = ${toNextTick}`, `shouldTick = ${shouldTick}`);
				this.swing(toNextTick, shouldTick ? this.currentTick : "no");
				this.renderComparator(this.currentTick);
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
		let ticks = this.audio.duration / this.timePerBeat;
		let ticksF = Math.floor(ticks);
		
		this.timelineWidth = this.scale * ticks;
		this.timeline.graph.inner.ticks.style.width = `${this.timelineWidth}px`;
		clog("DEBG", `maxTick = ${ticks}`);

		for (let tick = 0; tick <= ticksF; tick++) {
			if (!this.tickBars[tick]) {
				this.tickBars[tick] = document.createElement("div");

				if (tick % 4 === 0)
					this.tickBars[tick].classList.add("downbeat");

				this.timeline.graph.inner.ticks.appendChild(this.tickBars[tick]);
			}

			this.tickBars[tick].style.left = `${this.scale * tick}px`;
		}

		// Remove unused ticks
		for (let tick = ticks + 1; tick < this.tickBars.length; tick++) {
			if (this.tickBars[tick]) {
				this.timeline.graph.inner.ticks.removeChild(this.tickBars[tick]);
				delete this.tickBars[tick];
			}
		}
	},

	renderWaveform() {
		let duration = (this.timeline.graph.preview.clientWidth / (this.scale / 2)) * this.timePerBeat;
		this.drawWaveform(this.timeline.graph.preview, this.time, duration, {
			shift: 0.5
		});
	},

	renderComparator(tick) {
		let c = this.timingPanel.top.comparator;
		let from = Math.ceil(tick - (this.COMPARATOR_TICKS / 2));
		let to = Math.floor(tick + (this.COMPARATOR_TICKS / 2));
		let cFrom = this.comparatorCurrentFrom;
		let cTo = this.comparatorCurrentTo;
		let cTick = this.comparatorCurrentTick;
		let height = this.COMPARATOR_SIZE / this.COMPARATOR_TICKS;
		let reversed = false;
		
		if (typeof cTick === "number") {
			let d = cTick - tick;
			reversed = d > 0;

			if (d !== 0) {
				let oFrom = (d < 0) ? cFrom : to;
				let oTo = (d < 0) ? from : cTo;
	
				clog("DEBG", `comparator oob ${oFrom} -> ${oTo}`);
	
				// Remove out of bound
				for (let i = oFrom; i < oTo; i++) {
					if (!this.comparators[i])
						continue;

					if (c.contains(this.comparators[i].node))
						c.removeChild(this.comparators[i].node);
					
					this.comparators[i].update = true;
				}

				this.comparators[cTick].node.dataset.type = "none";
			}
		}

		clog("DEBG", `comparator ${tick} ${from} -> ${to}`);

		for (let i = from; i < to; i++) {
			if (!this.comparators[i]) {
				let node = document.createElement("div");
				node.classList.add("row");
				node.style.height = `${height}px`;

				let label = document.createElement("span");
				label.innerText = i;

				let canvas = document.createElement("canvas");
				node.append(canvas, label);
				this.comparators[i] = { tick: i, node, canvas, update: true }

				if (i % 4 === 0)
					node.classList.add("downbeat");
			}

			let cr = this.comparators[i];

			// Need update?
			if (cr.update) {
				clog("DEBG", "comparator update", cr.tick);

				requestAnimationFrame(() => {
					let tFrom = this.timePerBeat * (cr.tick - 0.5) + this.offset;
					this.drawWaveform(cr.canvas, tFrom, this.timePerBeat, {
						width: this.COMPARATOR_SIZE,
						height
					});
				});

				cr.update = false;
			}
			
			// Update state
			cr.node.dataset.type = (cr.tick < 0) ? "oob"
				: ((cr.tick < tick) ? "last"
				: ((cr.tick > tick) ? "next" : "current"));

			c.appendChild(cr.node);
		}

		this.comparatorCurrentFrom = from;
		this.comparatorCurrentTo = to;
		this.comparatorCurrentTick = tick;
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
		
		if (db < this.METER_MIN || db == -Infinity) {
			this.meters[channel].bar.style.height = `0`;
			this.meters[channel].value.innerText = `-∞ db`;
		} else {
			value = scaleValue(db, [this.METER_MIN, this.METER_MAX], [0, 100]);
			this.meters[channel].bar.style.height = `${value}%`;
			this.meters[channel].value.innerText = `${db.toFixed(2)} db`;
		}

		if (this.audio[`${channel}Max`] < value) {
			this.audio[`${channel}Max`] = value;
			this.meters[channel].max.style.bottom = `${value}%`;
		}
	},

	/**
	 * Swing back and forth by specified duration.
	 * @param	{Number}					duration		Duration to tick
	 * @param	{Number | "latch" | "no"}	tick
	 */
	async swing(duration, tick) {
		if (this.swingAnimator)
			this.swingAnimator.cancel();

		this.timingPanel.top.metronome.swing.style
			.setProperty("--duration", `${duration}s`);

		let start = this.currentSwingRotate;

		if (tick === "latch") {
			// Already locked, nothing to do.
			if (start === 0)
				return;

			let target = 0;
			let amount = target - start;

			// Easy return to neutral
			this.swingAnimator = new Animator(duration, Easing.InOutCubic, (t) => {
				this.swingRotate = start + (amount * t);
			});

			await this.swingAnimator.complete();
			this.playSound(this.sounds.latch);
			return;
		}

		// Play sound first
		if (tick !== "no")
			this.tickSound(tick);

		let target = this.swingLeft ? 30 : -30;
		let amount = target - start;
		this.swingLeft = !this.swingLeft;
		
		clog(`DEBG`, `swing 1st half start = ${start} -> ${target}`);

		// First half to go to edge.
		this.swingAnimator = new Animator(duration / 2, Easing.OutCubic, (t) => {
			this.swingRotate = start + (amount * t);
		});

		// Animation is completed but not fully done, indicating it's
		// been cancelled.
		if (!await this.swingAnimator.complete())
			return;

		this.timingPanel.top.metronome.swing.classList.remove("beat");

		// First tick, only swing first half.
		if (tick === 0 && start === 0)
			return;

		// Do the other half
		start = this.currentSwingRotate;
		target = 0;
		amount = target - start;

		clog(`DEBG`, `swing 2nd half start = ${start} -> ${target}`);

		this.swingAnimator = new Animator(duration / 2, Easing.InCubic, (t) => {
			this.swingRotate = start + (amount * t);
		});

		await this.swingAnimator.complete();
	},

	tickSound(tick) {
		// Play tick sound
		if (tick % 4 === 0) {
			this.playSound(this.sounds.tickDownbeat);
			clog("DEBG", "sound tick downbeat", tick);
		} else {
			this.playSound(this.sounds.tick);
			clog("DEBG", "sound tick", tick);
		}

		this.timingPanel.top.metronome.swing.classList.add("beat");
	},

	updateOffsetWidth() {
		let offsetWidth = this.pxPerSecond * this.offset;
		clog("DEBG", `offsetWidth = ${offsetWidth}`);
		this.timeline.graph.inner.ticks.style.marginLeft = `${offsetWidth}px`;
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
		this.pxPerSecond = this.scale / this.timePerBeat;

		this.reset();
		this.renderTicks();
		this.renderWaveform();
		this.updateOffsetWidth();
	},

	/**
	 * Set timing offset
	 * @param	{Number}	offset
	 */
	set offset(offset) {
		this.currentOffset = offset;
		this.updateOffsetWidth();
		this.renderWaveform();
		this.renderTicks();
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

		// Weird stuff... But it work
		let progress = currentTime / this.audio.duration;

		// I wish this font is fixed-width so I don't have
		// to do this ugly hack...
		this.timeline.timer.time.m1.innerText = pt.m > 10 ? `${pt.m}`[0] : "0";
		this.timeline.timer.time.m2.innerText = pt.m % 10;
		this.timeline.timer.time.s1.innerText = pt.s > 10 ? `${pt.s}`[0] : "0";
		this.timeline.timer.time.s2.innerText = pt.s % 10;
		this.timeline.timer.time.ms1.innerText = pt.ms[0];
		this.timeline.timer.time.ms2.innerText = pt.ms[1];
		this.timeline.timer.time.ms3.innerText = pt.ms[2];

		if (!this.playing)
			this.audio.instance.currentTime = currentTime;

		this.timeline.graph.inner.style.transform = `translateX(-${progress * this.timelineWidth}px)`;
		this.currentTime = currentTime;
		this.renderWaveform();
	},

	get time() {
		return this.currentTime;
	},

	set scale(scale) {
		this.tickScale = scale;
		this.pxPerSecond = this.tickScale / this.timePerBeat;
		this.renderTicks();
	},

	get scale() {
		return this.tickScale;
	}
}