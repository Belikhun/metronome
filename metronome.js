/**
 * /metronome.js
 * 
 * My own implementation of a metronome, with many features
 * that support for accurate measuring and calculating
 * offset and bpm for audio file.
 * 
 * This file is licensed under the MIT License.
 * See LICENSE in the project root for license information.
 * 
 * @author		Belikhun
 * @version		1.0
 * @license		MIT
 * @copyright	2022 Belikhun
 */

const metronome = {
	/** @type {TreeDOM} */
	timeline: undefined,

	/** @type {TreeDOM} */
	view: undefined,
	
	/** @type {TreeDOM} */
	meters: undefined,
	
	/** @type {TreeDOM} */
	monitors: undefined,
	
	/** @type {TreeDOM} */
	timingPanel: undefined,

	SAMPLE_PER_SEC: 600,

	METER_MIN: -49,
	METER_MAX: 5,
	METER_STEP: 5,
	METER_LINE: 10,
	METER_UPDATE: 40,
	meterLastUpdate: 0,

	/** Pixels per tick */
	tickScale: 80,
	pxPerSecond: 1,

	currentSwingRotate: 0,
	currentBPM: 0,
	currentOffset: 0,
	currentTime: 0,
	currentBeatTick: -1,
	currentRulerSampleRate: 0,
	seekTarget: 0,

	/** @type {HTMLElement} */
	offsetLabel: undefined,

	/** @type {HTMLElement} */
	bpmLabel: undefined,

	/**
	 * This is a specical variable used to tick in update
	 * function, do not use this if you don't know what you
	 * are doing!
	 * 
	 * For a accurate measurement of current tick please use
	 * `metronome.tick`.
	 * @type {Number}
	 */
	currentTick: -1,

	timePerBeat: 1,
	timelineWidth: 0,

	/** @type {Animator} */
	swingAnimator: undefined,

	/** @type {Animator} */
	seekAnimator: undefined,

	updateRequest: undefined,
	meterResetTimeout: undefined,
	lastFrameStart: undefined,
	isLoading: false,
	reUpdate: false,
	alternate: false,
	playing: false,
	swingLeft: true,

	/** @type {HTMLElement[]} */
	tickBars: [],

	/** @type {Object<number, HTMLElement[]>} */
	labels: [],

	FPS_SAMPLES: 60,
	fpsValues: [],

	UT_SAMPLES: 60,
	utValues: [],

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

		/** @type {Float32Array} */
		leftData: undefined,

		/** @type {Float32Array} */
		rightData: undefined,

		/** @type {Float32Array} */
		leftFreqs: undefined,

		/** @type {Float32Array} */
		rightFreqs: undefined,

		points: [],
		reduces: [],

		leftMax: 0,
		rightMax: 0,
		leftMaxTime: 0,
		rightMaxTime: 0,

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
	 * Log to console.
	 * @param	{CLogLevel}		level	Log level
	 * @param	{...CLogArg}	args	Log info
	 */
	log(level, ...args) {
		clog(level, {
			color: oscColor("pink"),
			text: "metronome",
			padding: 34,
			separate: true
		}, ...args);
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
		if (container && typeof container !== "object" || !container.tagName)
			throw { code: -1, description: `metronome.init(): not a valid container!` }

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

				ticks: { tag: "div", class: "ticks", child: {
					current: { tag: "span", class: "current", text: "0" },
					sep1: { tag: "sep", text: "/" },
					total: { tag: "span", class: "total", text: "0" }
				}},

				bpm: { tag: "div", class: "bpm", text: "0 BPM" },

				dots: { tag: "div", class: "dots", child: {
					0: { tag: "span" },
					1: { tag: "span" },
					2: { tag: "span" },
					3: { tag: "span" }
				}}
			}},

			graph: { tag: "span", class: "graph", child: {
				preview: { tag: "canvas", class: "preview" },
				inner: { tag: "div", class: "inner", child: {
					label: { tag: "div", class: "labels" },
					ticks: { tag: "div", class: "ticks" }
				}},

				cursor: { tag: "img", class: "cursor", src: "parts/timeCursor.svg" },
				loading: { tag: "div", class: "spinner" },
				overlay: { tag: "div", class: "overlay" },

				progress: { tag: "div", class: "progress", child: {
					canvas: { tag: "canvas" },
					view: { tag: "div", class: "view" },
					cursor: { tag: "img", class: "cursor", src: "parts/timeCursorSmall.svg" }
				}}
			}},

			buttons: { tag: "span", class: "buttons", child: {
				play: { tag: "span", class: ["button", "play"] },
				stop: { tag: "span", class: ["button", "stop"] },

				sub: { tag: "span", class: "sub", child: {
					prevTick: { tag: "span", class: ["button", "prevTick"] },
					nextTick: { tag: "span", class: ["button", "nextTick"] },
					end: { tag: "span", class: ["button", "end"] }
				}}
			}}
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

			label: { tag: "div", class: "label", text: "ÂM LƯỢNG" }
		});

		this.monitors = makeTree("div", "monitors", {
			label: { tag: "label", text: "Âm Thanh" },

			left: { tag: "span", class: "left", child: {
				canvas: { tag: "canvas" },
				ruler: { tag: "div", class: "ruler" },
				db: { tag: "div", class: "db" },
				label: { tag: "label", text: "Trái" }
			}},

			right: { tag: "span", class: "right", child: {
				canvas: { tag: "canvas" },
				ruler: { tag: "div", class: "ruler" },
				db: { tag: "div", class: "db" },
				label: { tag: "label", text: "Phải" }
			}},
		});

		this.timingPanel = makeTree("div", "timing", {
			label: { tag: "label", text: "Thời gian" },

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
			}},

			controls: { tag: "div", class: "controls", child: {
				offset: { tag: "div", class: "offset", child: {
					top: { tag: "div", class: "top", child: {
						adjust: this.createAdjustmentButton({
							label: "Độ trễ",
							steps: [1, 2, 5, 10, "1 tick"],
							onInput: (value) => {
								switch (value) {
									case "1 tick":
										this.offset -= this.timePerBeat;
										break;
	
									case "-1 tick":
										this.offset += this.timePerBeat;
										break;
	
									default:
										this.offset += (value / 1000);
								}
							}
						}),

						now: createButton("NOW", {
							style: "round",
							icon: "stopwatch",
							complex: true,
							onClick: () => this.offset = this.time
						})
					}},

					input: createOscInput({
						label: "Độ trễ",
						type: "number",
						onEnter: (value) => this.offset = value / 1000
					})
				}},
	
				bpm: { tag: "div", class: "bpm", child: {
					adjust: this.createAdjustmentButton({
						label: "BPM",
						steps: [0.1, 0.2, 0.5, 1, "x2"],
						onInput: (value) => {
							switch (value) {
								case "x2":
									this.bpm *= 2;
									break;

								case "/2":
									this.bpm /= 2;
									break;

								default:
									this.bpm += value;
							}
						}
					}),

					input: createOscInput({
						label: "BPM",
						type: "number",
						onEnter: (value) => this.bpm = value
					})
				}}
			}},

			inputs: { tag: "div", class: "inputs", child: {
				timeAdjust: this.createAdjustmentButton({
					label: "Thời gian",
					steps: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60],
					onInput: (value) => this.seek(this.time + value)
				}),

				time: createOscInput({
					type: "number",
					label: "Thời gian",
					value: this.time,
					onEnter: (value) => this.seek(value)
				}),

				scale: createOscInput({
					type: "number",
					label: "Tỉ lệ (px)",
					onEnter: (value) => this.scale = value
				}),

				samples: createOscInput({
					type: "number",
					label: "SAMPLE_PER_SEC",
					value: this.SAMPLE_PER_SEC,
					onEnter: (value) => {
						this.SAMPLE_PER_SEC = value;
						this.sampleDataPoints();
						this.renderWaveform();
						this.renderComparator(this.currentTick);
					}
				})
			}}
		});

		this.view = makeTree("div", "view", {
			meters: this.meters,

			panels: { tag: "span", class: "panels", child: {
				waves: this.monitors,
				timing: this.timingPanel
			}},

			fps: { tag: "span", class: "fps", child: {
				value: { tag: "div", class: "value", text: "not running" },
				time: { tag: "div", class: "time", text: "∞ μs" }
			}}
		});

		if (typeof Scrollable === "function") {
			new Scrollable(this.view, {
				content: this.view.panels
			});
		}

		this.timingPanel.top.comparator.style.width = `${this.COMPARATOR_SIZE}px`;
		this.timingPanel.top.comparator.style.height = `${this.COMPARATOR_SIZE}px`;
		container.tabIndex = -1;
		container.classList.add("MetronomeContainer");
		container.append(this.timeline, this.view);
		container.addEventListener("keydown", e => this.keyPress(e));

		this.loading = true;

		//* ========================= Events =========================

		this.timeline.buttons.play.addEventListener("click", () => this.toggle());
		this.timeline.buttons.stop.addEventListener("click", () => this.stop());
		this.timeline.buttons.sub.prevTick.addEventListener("click", () => this.seekLastTick());
		this.timeline.buttons.sub.nextTick.addEventListener("click", () => this.seekNextTick());
		this.timeline.buttons.sub.end.addEventListener("click", () => this.seek(this.audio.duration));

		this.timeline.graph.addEventListener("wheel", (e) => {
			// Scale instead when ctrl key is holding
			if (e.ctrlKey) {
				e.preventDefault();
				this.scale = this.tickScale - (e.deltaY / 100) * 10;
				return;
			}

			this.seek(this.seekTarget + (e.deltaY * (1 / this.pxPerSecond)));
		});

		this.timeline.graph.progress.addEventListener("click", (e) => {
			let rect = this.timeline.graph.progress.getBoundingClientRect();
			let posX = e.clientX - rect.x;
			this.seek(this.audio.duration * (posX / this.graphWidth));
		});

		// Dragging timeline
		this.timeline.graph.overlay.addEventListener("mousedown", (e) => this.startTimelineDrag(e));
		window.addEventListener("mouseup", () => this.endTimelineDrag());

		//* ========================= Init =========================

		this.meters.style.setProperty("--rate", `${this.METER_UPDATE}ms`);
		this.bpm = bpm;
		this.scale = scale;
		this.initDbRulers();
		this.renderComparator(0);

		await this.initSounds();
		this.loading = false;
	},

	timelineDragging: false,
	timelineDragStart: 0,
	timelineDragStartTime: 0,
	timelineDragLastTick: 0,
	timelineDragDelta: 0,
	timelineDragUpdater: undefined,

	/**
	 * Setup timeline for dragging
	 * @param {MouseEvent} e
	 */
	startTimelineDrag(e) {
		if (this.playing)
			return;

		this.timelineDragStart = e.clientX;
		this.timelineDragStartTime = this.time;
		this.timelineDragLastTick = 0;
		this.timelineDragDelta = 0;
		this.timelineDragUpdater = (e) => this.updateTimelineDrag(e);
		this.timelineDragging = true;
		window.addEventListener("mousemove", this.timelineDragUpdater);
	},

	/**
	 * Update dragging
	 * @param {MouseEvent} e
	 */
	updateTimelineDrag(e) {
		let delta = e.clientX - this.timelineDragStart;
		this.timelineDragDelta = delta - this.timelineDragLastTick;
		this.timelineDragLastTick = delta;
		this.time = this.timelineDragStartTime - (delta / this.pxPerSecond);
	},

	/**
	 * Update dragging
	 * @param {MouseEvent} e
	 */
	endTimelineDrag() {
		if (!this.timelineDragging)
			return;

		if (this.timelineDragDelta < -10 || this.timelineDragDelta > 10)
			this.seek(this.time - ((this.timelineDragDelta * 4) / this.pxPerSecond));

		window.removeEventListener("mousemove", this.timelineDragUpdater);
		this.timelineDragUpdater = undefined;
	},

	/**
	 * Handle key event
	 * @param	{KeyboardEvent}	event 
	 */
	keyPress(event) {
		switch (event.code) {
			case "Space":
				this.toggle();
				break;
		
			case "KeyS":
				this.stop();
				break;

			case "ArrowRight":
				this.seekNextTick();
				break;

			case "ArrowLeft":
				this.seekLastTick();
				break;

			default:
				break;
		}
	},

	/**
	 * Create fine value adjustment button.
	 * @param		{Object}						options
	 * @param		{String}						options.label
	 * @param		{Number[]}						options.steps
	 * @param		{Number}						options.holdInterval
	 * @param		{(value: Number|String) => any}	options.onInput
	 * @returns 
	 */
	createAdjustmentButton({
		label = "TEST",
		steps = [1, 2, 5, 10],
		holdInterval = 100,
		onInput = () => {}
	}) {
		let container = makeTree("div", "fineAdjustmentButton", {
			decrease: { tag: "span", class: "buttons" },
			increase: { tag: "span", class: "buttons" },
			label: { tag: "span", class: "label", text: label },
			value: { tag: "span", class: "value", text: 0 }
		});

		let decreases = []
		let increases = []

		const hoverD = (index, step) => {
			// Reset
			for (let i of decreases)
				i.classList.remove("hover");

			if (index > -1) {
				container.value.classList.add("show");
				container.value.innerText = step;
				container.value.dataset.pos = "left";

				for (let i = decreases.length - 1; i >= index; i--)
					decreases[i].classList.add("hover");
			} else {
				container.value.classList.remove("show");
			}
		}

		const hoverI = (index, step) => {
			// Reset
			for (let i of increases)
				i.classList.remove("hover");

			if (index > -1) {
				container.value.classList.add("show");
				container.value.innerText = (step[0] === "x") ? step : `+${step}`;
				container.value.dataset.pos = "right";

				for (let i = 0; i <= index; i++)
					increases[i].classList.add("hover");
			} else {
				container.value.classList.remove("show");
			}
		}

		const bounce = async () => {
			container.value.classList.remove("bounce");
			await nextFrameAsync();
			container.value.classList.add("bounce");
		}

		/**
		 * Init click events
		 * @param {HTMLElement}	button
		 * @param {Number}		step
		 */
		const initClick = (button, step) => {
			let holding = false;
			let timeout = undefined;
			let interval = undefined;

			const reset = () => {
				holding = false;
				clearTimeout(timeout);
				clearInterval(interval);
				timeout = undefined;
				interval = undefined;
			}

			button.addEventListener("mousedown", () => {
				onInput(step);
				bounce(button);
				holding = true;

				timeout = setTimeout(() => {
					if (!holding) {
						reset();
						return;
					}

					interval = setInterval(() => {
						onInput(step);
						bounce(button);
					}, holdInterval);
				}, 500);
			});

			window.addEventListener("mouseup", () => reset());
		}

		// Decrease buttons
		for (let [i, step] of steps.reverse().entries()) {
			step = (typeof step === "number")
				? -step
				: (step[0] === "x" ? step.replace("x", "/") : `-${step}`);

			let button = document.createElement("span");
			button.dataset.index = i;
			button.dataset.value = step;
			container.decrease.appendChild(button);
			let index = decreases.push(button) - 1;
			button.addEventListener("mouseenter", () => hoverD(index, step));
			initClick(button, step);
		}

		// Increase buttons
		for (let [i, step] of steps.reverse().entries()) {
			let button = document.createElement("span");
			button.dataset.index = steps.length - i - 1;
			button.dataset.value = step;
			container.increase.appendChild(button);
			let index = increases.push(button) - 1;
			button.addEventListener("mouseenter", () => hoverI(index, step));
			initClick(button, step);
		}

		container.decrease.addEventListener("mouseleave", () => hoverD(-1));
		container.increase.addEventListener("mouseleave", () => hoverI(-1));
		container.addEventListener("mouseleave", () => container.value.classList.remove("bounce"));

		return {
			container
		}
	},

	initDbRulers() {
		emptyNode(this.meters.ruler);
		emptyNode(this.monitors.left.db);
		emptyNode(this.monitors.right.db);
		let total = this.METER_MAX - this.METER_MIN;
		let addToMonitors = false;

		// Generate ruler
		for (let i = this.METER_MIN; i <= this.METER_MAX; i += 1) {
			addToMonitors = false;

			let node = document.createElement("div");
			node.style.bottom = `${(Math.abs(i - this.METER_MIN) / total) * 100}%`;
			
			if (i === this.METER_MIN) {
				node.innerText = `db`;
				node.classList.add("step");
				addToMonitors = true;
			}

			if (i % this.METER_STEP === 0) {
				node.innerText = i;
				node.classList.add("step");
				addToMonitors = true;
			}
			
			if (i % this.METER_LINE === 0) {
				node.classList.add("line");
				addToMonitors = true;
			}

			this.meters.ruler.appendChild(node);

			if (addToMonitors) {
				this.monitors.left.db.appendChild(node.cloneNode(true));
				this.monitors.right.db.appendChild(node.cloneNode(true));
			}
		}
	},

	async initSounds() {
		let promises = []

		for (let [key, value] of Object.entries(this.sounds)) {
			let rl, el;

			promises.push(new Promise((resolve, reject) => {
				this.sounds[key] = new Audio(value);

				this.sounds[key].addEventListener("error", el = (e) => {
					this.log("ERRR", `Error loading sound: ${value}`, e);
					reject({ code: -1, description: `Cannot load sound ${value}`, data: e });
				});

				this.sounds[key].addEventListener("canplaythrough", rl = () => {
					this.log("OKAY", `Loaded sound ${value}`);
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
		if (this.loading)
			throw { code: -1, description: `metronome.load(): another audio is already loading!` }

		this.loading = true;
		this.log("INFO", `loading`, audio);

		if (this.playing)
			await this.pause();

		this.audio.context = new AudioContext();

		try {
			if (typeof audio === "string") {
				let response = await fetch(audio);

				if (!response.ok)
					throw response;

				let clone = response.clone();
				this.audio.buffer = await this.audio.context.decodeAudioData(await response.arrayBuffer());
				this.audio.instance = new Audio(URL.createObjectURL(await clone.blob()));
			} else {
				let reader = new FileReader();
				reader.readAsArrayBuffer(audio);

				let buffer = await new Promise((resolve, reject) => {
					reader.addEventListener("error", (e) => reject(e));
					reader.addEventListener("loadend", () => resolve(reader.result));
				});

				this.audio.buffer = await this.audio.context.decodeAudioData(buffer);
				this.audio.instance = new Audio(URL.createObjectURL(audio));
			}
		} catch(error) {
			let e = { code: -1, description: `failed to load audio file "${audio}"`, data: error }
			errorHandler(e);
			this.loading = false;
			throw e;
		}

		// Check audio not fully loaded
		if (this.audio.instance.readyState < 4) {
			this.log("INFO", "Audio is not fully loaded, wait for it to fully load...");

			await new Promise((resolve) => {
				this.log("OKAY", "Audio loaded.");
				this.audio.instance.addEventListener("canplaythrough", () => resolve());
			});
		}

		this.audio.duration = this.audio.instance.duration;

		this.clearLabels();
		this.sampleDataPoints();
		this.renderTicks();
		this.resetMonitors();

		await this.audioInit();
		this.reset();

		// Render progress's canvas
		this.drawWaveform(this.timeline.graph.progress.canvas, 0, this.audio.duration);

		this.time = 0;
		this.renderComparator(0);
		this.loading = false;
	},

	async audioInit() {
		this.audio.splitter = this.audio.context.createChannelSplitter(2);
		this.audio.left = this.audio.context.createAnalyser();
		this.audio.right = this.audio.context.createAnalyser();

		this.audio.left.fftSize = 128;
		this.audio.right.fftSize = 128;

		this.audio.leftData = new Float32Array(this.audio.left.frequencyBinCount);
		this.audio.rightData = new Float32Array(this.audio.right.frequencyBinCount);
		this.audio.leftFreqs = new Float32Array(this.audio.left.frequencyBinCount);
		this.audio.rightFreqs = new Float32Array(this.audio.right.frequencyBinCount);
		
		let source = this.audio.context.createMediaElementSource(this.audio.instance);
		this.audio.splitter.connect(this.audio.left, 0, 0);
		this.audio.splitter.connect(this.audio.right, 1, 0);
		source.connect(this.audio.splitter);
		source.connect(this.audio.context.destination);

		// Draw monitor's ruler.
		this.updateMonitorRulers();
	},
	
	sampleDataPoints() {
		let start = performance.now();
		this.log("INFO", "sampling data points...");
		
		this.audio.points = []
		this.audio.reduces = []
		let channels = this.audio.buffer.numberOfChannels > 1
			? [0, 1] : [0];

		for (let c of channels) {
			this.audio.points[c] = [];

			let max = 0;
			let value;
			let raw = this.audio.buffer.getChannelData(c);
			let samples = Math.floor(this.SAMPLE_PER_SEC * this.audio.buffer.duration);
			const blockSize = Math.floor(raw.length / samples);
			
			for (let i = 0; i < samples; i++) {
				let blockStart = Math.floor((blockSize * i) - (blockSize / 2));
				blockStart = Math.max(blockStart, 0);
				let sum = 0;
	
				for (let j = 0; j < blockSize; j++)
					sum += Math.abs(raw[blockStart + j]);
	
				value = sum / blockSize;
				this.audio.points[c].push(value);

				if (value > max)
					max = value;
			}
	
			const multiplier = Math.pow(max, -1);
			this.audio.points[c] = this.audio.points[c].map(i => i * multiplier);
		}

		this.log("OKAY", `sampling complete! took ${performance.now() - start}ms`);
	},

	getSamplePoints(factor) {
		if (!this.audio.points || this.audio.points.length === 0)
			return []

		if (factor === 1)
			return this.audio.points;

		if (!this.audio.reduces[factor]) {
			this.log("INFO", `calculating sample points by factor ${factor}`);
			this.audio.reduces[factor] = [
				reduceNumbersArray(this.audio.points[0], factor),
				this.audio.points[1]
					? reduceNumbersArray(this.audio.points[1], factor)
					: []
			]
		}

		return this.audio.reduces[factor];
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

		// Calculate initial data point's count to get reduce ratio.
		let sps = this.SAMPLE_PER_SEC;
		let count = length * sps;
		let ratio = Math.max(Math.round(count / width), 1);
		sps /= ratio;
		
		// New count
		count = length * sps;
		let points = this.getSamplePoints(ratio);

		let ctx = canvas.getContext("2d");
		let start = from * sps;
		let fStart = Math.floor(start);
		let fCount = Math.ceil(count);
		let to = fStart + fCount;
		let data, x;

		ctx.clearRect(0, 0, width, height);
		
		ctx.fillStyle = color;
		
		if (points[0]) {
			// Left channel on top
			ctx.beginPath();
			ctx.moveTo(0, height / 2 + 1);
	
			for (let i = fStart; i <= to; i += 1) {
				data = points[0][i] || 0;
	
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

		if (points[1]) {
			// Right channel on bottom
			ctx.beginPath();
			ctx.moveTo(0, height / 2 - 1);
	
			for (let i = fStart; i <= to; i += 1) {
				data = points[1][i] || 0;
	
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

	/**
	 * Draw monitor based on audio's data.
	 * @param	{HTMLCanvasElement}		canvas
	 * @param	{Number[] | Uint8Array}	data
	 * @param	{Object}				options
	 * @param	{Number}				options.color	Wave color
	 * @param	{Number}				options.width	Canvas width
	 * @param	{Number}				options.height	Canvas height
	 * @param	{Number}				options.space	Bar spacing
	 * @param	{"line" | "bar"}		options.style	Canvas render style
	 */
	drawMonitor(canvas, data = [], {
		color = "#76d1ff",
		width = undefined,
		height = undefined,
		space = 4,
		style = "line"
	} = {}) {
		if (typeof width === "number")
			canvas.width = width;
		else
			width = canvas.width = canvas.clientWidth;
		
		if (typeof height === "number")
			canvas.height = height;
		else
			height = canvas.height = canvas.clientHeight;

		let ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, width, height);

		if (data.length === 0)
			return;
		
		if (style === "bar") {
			// Bar style
			ctx.fillStyle = color;
			let barWidth = (width - space * (data.length - 1)) / data.length;
			let x = 0, value = 0;
	
			for (let point of data) {
				value = scaleValue(point + 30, [this.METER_MIN, this.METER_MAX], [0, 1]);
				ctx.fillRect(x, height * (1 - value), barWidth, height);
				x += barWidth + space;
			}
		} else {
			// Line style
			ctx.strokeStyle = color;
			ctx.lineWidth = 3;
			let barWidth = width / data.length;
			let x = 0, value = 0;
	
			for (let point of data) {
				value = scaleValue(point + 30, [this.METER_MIN, this.METER_MAX], [0, 1]);
	
				if (x === 0) {
					// Initial point we do moveTo
					ctx.moveTo(0, height * (1 - value));
				} else {
					ctx.lineTo(x, height * (1 - value));
				}
	
				x += barWidth;
			}
	
			ctx.stroke();
		}
	},

	resetMonitors() {
		this.drawMonitor(this.monitors.left.canvas);
		this.drawMonitor(this.monitors.right.canvas);
	},

	/**
	 * Draw a badge on timeline
	 * @param	{String}							badge 
	 * @param	{Number}							tick 
	 * @param	{Object}							options
	 * @param	{String}							options.color
	 * @param	{"left" | "right" | "center"}		options.align
	 */
	drawLabel(label, tick, {
		color = "gray",
		align = "center"
	} = {}) {
		if (!this.labels[tick])
			this.labels[tick] = []

		let node = document.createElement("tag");
		node.innerText = label;
		node.dataset.color = color;
		node.dataset.align = align;
		node.dataset.tick = tick;
		node.style.left = `${this.scale * tick}px`;
		this.timeline.graph.inner.label.appendChild(node);
		this.labels[tick].push(node);
		return node;
	},

	updateLabels() {
		for (let [tick, labels] of Object.entries(this.labels)) {
			for (let label of labels)
				label.style.left = `${this.scale * tick}px`;
		}
	},

	clearLabels() {
		emptyNode(this.timeline.graph.inner.label);
		this.offsetLabel = undefined;
		this.bpmLabel = undefined;
		this.labels = []
	},

	async play() {
		if (!this.audio.instance || this.playing)
			return;

		if (this.audio.context.state === "suspended")
			await this.audio.context.resume();

		if (this.seekAnimator) {
			this.seekAnimator.cancel();
			this.seekAnimator = null;
			this.seekTarget = this.time;
		}

		this.playing = true;
		this.timeline.buttons.play.classList.add("pause");
		await this.audio.instance.play();
		this.startUpdate();

		// Reset meter
		clearTimeout(this.meterResetTimeout);
		this.meters.classList.remove("slow");

		// Decrease current swing tick to re-calculate time to
		// next tick.
		this.currentSwingTick -= 1;
	},

	async pause() {
		if (!this.audio.instance || !this.playing)
			return;

		this.playing = false;
		this.seekTarget = this.time;
		this.timeline.buttons.play.classList.remove("pause");
		this.audio.instance.pause();
		this.stopUpdate();
		this.resetChannelMeter();
		this.swing(this.timePerBeat * 2, "latch");
	},

	async toggle() {
		if (this.playing)
			await this.pause();
		else
			await this.play();
	},

	async stop() {
		if (!this.audio.instance)
			return;

		await this.pause();
		this.audio.instance.currentTime = 0;
		this.time = 0;
		this.seekTarget = 0;
		this.renderComparator(0);
		this.reset();
	},

	async completed() {
		this.log("INFO", "Playback ended, stopped updating.");
		this.stopUpdate();
		this.playing = false;
		
		this.resetChannelMeter();
		this.time = this.audio.duration;
		this.seekTarget = this.time;
		this.swing(this.timePerBeat * 2, "latch");
		this.timeline.buttons.play.classList.remove("pause");
	},

	reset() {
		this.currentTick = -1;
	},

	startUpdate() {
		cancelAnimationFrame(this.updateRequest);
		this.reUpdate = true;
		this.lastFrameStart = performance.now();
		this.reset();
		this.update();
	},

	stopUpdate() {
		this.reUpdate = false;
		this.lastFrameStart = undefined;
		this.view.fps.value.innerText = "not running";
		this.view.fps.value.dataset.color = "default";
		this.view.fps.time.innerText = "∞ μs";
		this.view.fps.time.dataset.color = "default";
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
	
				this.log("DEBG", "------ tick", this.currentTick, `nextTickTime = ${nextTickTime}`, `toNextTick = ${toNextTick}`, `shouldTick = ${shouldTick}`);
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

		// Update monitors
		this.updateMonitors();

		if (this.alternate) {
			// Alternate frame.
		}

		this.alternate = !this.alternate;

		// Update fps
		// This, I don't want to create new variable, so
		// using existing variable to store while updating
		// now value;
		let duration = now;
		now = performance.now();
		duration = now - duration;

		let fTime = now - this.lastFrameStart;
		let fps = 1 / (fTime / 1000);
		this.lastFrameStart = now;

		this.fpsValues.push(fps);
		this.utValues.push(duration);

		if (this.fpsValues.length > this.FPS_SAMPLES)
			this.fpsValues.shift();

		if (this.utValues.length > this.UT_SAMPLES)
			this.utValues.shift();

		fps = this.fpsValues.reduce((a, b) => a + b, 0) / this.fpsValues.length;
		duration = this.utValues.reduce((a, b) => a + b, 0) / this.utValues.length;
		this.view.fps.value.innerText = `${fps.toFixed(2)} fps`;
		this.view.fps.value.dataset.color = (fps > 30) ? "green" : ((fps > 10) ? "yellow" : "red");
		this.view.fps.time.innerText = `${(duration * 1000).toFixed(1)}μs`;
		this.view.fps.time.dataset.color = (duration < 0.6) ? "green" : ((duration < 2) ? "yellow" : "red");

		if (this.audio.instance.paused) {
			this.completed();
			return;
		}

		if (this.reUpdate)
			this.updateRequest = requestAnimationFrame(() => this.update());
	},

	renderTicks() {
		let ticks = this.ticks;
		let tickF = Math.floor(ticks);
		
		this.timelineWidth = this.scale * ticks;
		this.timeline.graph.inner.style.width = `${this.timelineWidth}px`;
		this.log("DEBG", `maxTick = ${ticks}`);

		for (let tick = 0; tick <= tickF; tick++) {
			if (!this.tickBars[tick]) {
				this.tickBars[tick] = document.createElement("div");

				if (tick % 4 === 0)
					this.tickBars[tick].classList.add("downbeat");

				this.timeline.graph.inner.ticks.appendChild(this.tickBars[tick]);
			}

			if (tick > 0 && tick % 4 === 0) {
				if (!this.labels[tick])
					this.drawLabel(tick / 4, tick);
			}

			this.tickBars[tick].style.left = `${this.scale * tick}px`;
		}

		// Remove unused ticks
		for (let tick = tickF + 1; tick < this.tickBars.length; tick++) {
			if (this.tickBars[tick]) {
				this.timeline.graph.inner.ticks.removeChild(this.tickBars[tick]);
				delete this.tickBars[tick];
			}
		}
	},

	renderWaveform() {
		this.drawWaveform(
			this.timeline.graph.preview,
			this.time,
			this.timelineDuration,
			{ shift: 0.5 });
	},

	renderComparator(tick, force = false) {
		if (tick === this.comparatorCurrentTick && !force)
			return;

		let c = this.timingPanel.top.comparator;
		let from = Math.ceil(tick - (this.COMPARATOR_TICKS / 2));
		let to = Math.floor(tick + (this.COMPARATOR_TICKS / 2));
		let cFrom = this.comparatorCurrentFrom;
		let cTo = this.comparatorCurrentTo;
		let cTick = this.comparatorCurrentTick;
		let height = this.COMPARATOR_SIZE / this.COMPARATOR_TICKS;
		
		if (typeof cTick === "number") {
			let d = cTick - tick;

			if (typeof d === "number" && d !== 0) {
				let oFrom = (d < 0) ? cFrom : to;
				let oTo = (d < 0) ? from : cTo;
	
				this.log("DEBG", `comparator oob ${oFrom} -> ${oTo}`);
	
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

		this.log("DEBG", `comparator ${tick} ${from} -> ${to}`);

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
			if (cr.update || force) {
				this.log("DEBG", "comparator update", cr.tick);

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

	updateMonitors() {
		this.audio.left.getFloatFrequencyData(this.audio.leftFreqs);
		this.audio.right.getFloatFrequencyData(this.audio.rightFreqs);
		this.drawMonitor(this.monitors.left.canvas, this.audio.leftFreqs);
		this.drawMonitor(this.monitors.right.canvas, this.audio.rightFreqs);
	},

	updateMonitorRulers({
		step = 1000,
		label = 2000
	} = {}) {
		let sampleRate = this.audio.context.sampleRate;
		if (sampleRate === this.currentRulerSampleRate)
			return;

		this.currentRulerSampleRate = sampleRate;
		emptyNode(this.monitors.left.ruler);
		emptyNode(this.monitors.right.ruler);
		let target = sampleRate / 2;

		for (let i = 0; i <= target; i += step) {
			let p = i / target;

			let node = document.createElement("span");
			if (i % label === 0) {
				node.classList.add("label");
				node.innerText = (i > 0)
					? `${i / 1000}k`
					: `Hz`;
			}

			node.style.left = `${p * 100}%`;
			node.dataset.value = i;
			this.monitors.left.ruler.appendChild(node);
			this.monitors.right.ruler.appendChild(node.cloneNode(true));
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

		if (db >= -1)
			this.meters[channel].clip.classList.add("active");
		
		if (db < this.METER_MIN || db == -Infinity) {
			this.meters[channel].bar.style.height = `0`;
			this.meters[channel].value.innerText = `-∞ db`;
		} else {
			value = scaleValue(db, [this.METER_MIN, this.METER_MAX], [0, 100]);
			this.meters[channel].bar.style.height = `${value}%`;
			this.meters[channel].value.innerText = `${db.toFixed(1)} db`;
		}

		// If not updated for too long, reset max value.
		let now = performance.now();
		if (now - this.audio[`${channel}MaxTime`] > 1000)
			this.audio[`${channel}Max`] = 0;

		if (this.audio[`${channel}Max`] < value) {
			this.audio[`${channel}Max`] = value;
			this.audio[`${channel}MaxTime`] = performance.now();
			this.meters[channel].max.style.bottom = `${value}%`;
		}
	},

	resetChannelMeter() {
		clearTimeout(this.meterResetTimeout);

		this.meterResetTimeout = setTimeout(async () => {
			this.audio.leftMax = 0;
			this.audio.rightMax = 0;
			this.meters.classList.add("slow");
	
			await nextFrameAsync();
			this.meters.left.max.style.bottom = `0`;
			this.meters.left.bar.style.height = `0`;
			this.meters.left.value.innerText = `-∞ db`;
			this.meters.left.clip.classList.remove("active");
			this.meters.right.max.style.bottom = `0`;
			this.meters.right.bar.style.height = `0`;
			this.meters.right.value.innerText = `-∞ db`;
			this.meters.right.clip.classList.remove("active");
		}, 500);
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
		
		this.log(`DEBG`, `swing 1st half start = ${start} -> ${target}`);

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

		this.log(`DEBG`, `swing 2nd half start = ${start} -> ${target}`);

		this.swingAnimator = new Animator(duration / 2, Easing.InCubic, (t) => {
			this.swingRotate = start + (amount * t);
		});

		await this.swingAnimator.complete();
	},

	tickSound(tick) {
		// Play tick sound
		if (tick % 4 === 0) {
			this.playSound(this.sounds.tickDownbeat);
			this.log("DEBG", "sound tick downbeat", tick);
		} else {
			this.playSound(this.sounds.tick);
			this.log("DEBG", "sound tick", tick);
		}

		this.timingPanel.top.metronome.swing.classList.add("beat");
	},

	updateOffsetWidth() {
		let offsetWidth = this.pxPerSecond * this.offset;
		this.log("DEBG", `offsetWidth = ${offsetWidth}`);
		this.timeline.graph.inner.style.marginLeft = `${offsetWidth}px`;
	},

	updateDurationView() {
		// Update progress's view zone
		let viewWidth = (this.graphWidth * (this.timelineDuration / this.audio.duration)) / 2;
		this.timeline.graph.progress.view.style.width = `${viewWidth}px`;
	},

	updateTimelineProgress() {
		let progress = this.time / this.audio.duration;
		this.timeline.graph.inner.style.transform = `translateX(-${progress * this.timelineWidth}px)`;
		this.timeline.graph.progress.view.style.left = `${progress * 100}%`;
		this.timeline.graph.progress.cursor.style.left = `${progress * 100}%`;
	},

	/**
	 * Seek to specified time, in style!
	 * @param	{Number}	time
	 */
	async seek(time) {
		if (!this.audio.instance)
			return;

		time = Math.min(time, this.audio.duration);
		time = Math.max(time, 0);

		if (this.currentTime === time)
			return;
		
		this.seekTarget = time;
		if (!this.playing) {
			let current = this.time;
			let delta = time - current;
			let duration = Math.pow(Math.abs(delta), 0.3) / 3;
			
			if (this.seekAnimator)
				this.seekAnimator.cancel();

			this.seekAnimator = new Animator(duration, Easing.OutQuart, (t) => {
				this.time = current + (delta * t);
				this.audio.instance.currentTime = this.time;
			});

			if (!await this.seekAnimator.complete())
				return;
			
			this.seekAnimator = undefined;
			this.currentTick = this.tick; 
		} else {
			this.audio.instance.currentTime = time;
			this.time = time;
		}
	},

	async seekNextTick() {
		let tick = (this.seekTarget - this.offset) / this.timePerBeat;
		tick = round(tick, 2);

		this.seekTarget = Math.floor(tick + 1) * this.timePerBeat + this.offset;
		await this.seek(this.seekTarget);
	},

	async seekLastTick() {
		let tick = (this.seekTarget - this.offset) / this.timePerBeat;
		tick = round(tick, 2);

		if (Math.floor(tick) < tick)
			this.seekTarget = Math.floor(tick) * this.timePerBeat;
		else
			this.seekTarget = Math.floor(tick - 1) * this.timePerBeat;

		this.seekTarget += this.offset;
		await this.seek(this.seekTarget);
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

		bpm = round(round(bpm, 4), 3);
		this.timingPanel.controls.bpm.input.value = bpm;
		this.currentBPM = bpm;
		this.timePerBeat = 60 / bpm;
		this.pxPerSecond = this.scale / this.timePerBeat;

		let weightPos = scaleValue(bpm, [0, 500], [6, 76]);
		this.timingPanel.top.metronome.swing.weight.style.top = `${weightPos}%`;
		this.timingPanel.top.metronome.value.innerText = bpm;
		this.timeline.timer.bpm.innerText = `${bpm} BPM`;
		this.timeline.timer.ticks.total.innerText = this.ticks.toFixed(1);

		if (!this.bpmLabel) {
			this.bpmLabel = this.drawLabel(`0 BPM`, 0, {
				color: "green",
				align: "right"
			});
		}

		this.bpmLabel.innerText = `${bpm} BPM`;
		this.reset();
		this.renderTicks();
		this.renderWaveform();
		this.renderComparator(Math.floor(this.tick), true);
		this.updateOffsetWidth();
		this.updateDurationView();
		this.updateTimelineProgress();
	},

	get bpm() {
		return this.currentBPM;
	},

	/**
	 * Set timing offset
	 * @param	{Number}	offset
	 */
	set offset(offset) {
		offset = round(round(offset, 4), 3);
		this.currentOffset = offset;
		this.timingPanel.controls.offset.input.value = offset * 1000;

		if (!this.offsetLabel) {
			this.offsetLabel = this.drawLabel(`O 0`, 0, {
				color: "yellow",
				align: "left"
			});
		}

		this.offsetLabel.innerText = `O ${offset * 1000}`;
		this.updateOffsetWidth();
		this.renderWaveform();
		this.renderComparator(this.comparatorCurrentTick, true);
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
		if (!this.audio.instance)
			return;
			
		currentTime = Math.max(0, currentTime);
		currentTime = Math.min(this.audio.duration, currentTime);

		this.currentTime = currentTime;
		let pt = parseTime(currentTime, { msDigit: 3 });
		let tickF = Math.floor(this.tick);

		// I wish this font is fixed-width so I don't have
		// to do this ugly hack...
		this.timeline.timer.time.m1.innerText = pt.m > 10 ? `${pt.m}`[0] : "0";
		this.timeline.timer.time.m2.innerText = pt.m % 10;
		this.timeline.timer.time.s1.innerText = pt.s > 10 ? `${pt.s}`[0] : "0";
		this.timeline.timer.time.s2.innerText = pt.s % 10;
		this.timeline.timer.time.ms1.innerText = pt.ms[0];
		this.timeline.timer.time.ms2.innerText = pt.ms[1];
		this.timeline.timer.time.ms3.innerText = pt.ms[2];

		if (!this.playing) {
			// Update comparator
			this.renderComparator(tickF);
			this.audio.instance.currentTime = currentTime;
		}
		
		if (!this.seekAnimator || this.seekAnimator.completed)
			this.seekTarget = currentTime;

		let bt = tickF % 4;
		if (this.currentBeatTick !== bt) {
			this.timeline.timer.dots.dataset.tick = bt;
			this.currentBeatTick = bt;
		}

		this.timeline.timer.ticks.current.innerText = this.tick.toFixed(1);

		this.updateTimelineProgress();
		this.timingPanel.inputs.time.value = currentTime;
		this.renderWaveform();
	},

	get time() {
		return this.currentTime;
	},

	set scale(scale) {
		if (scale < 1)
			scale = 10;

		this.tickScale = scale;
		this.timingPanel.inputs.scale.value = scale;
		this.pxPerSecond = this.tickScale / this.timePerBeat;

		this.renderTicks();
		this.renderWaveform();
		this.updateOffsetWidth();
		this.updateDurationView();
		this.updateTimelineProgress();
		this.updateLabels();
	},

	get scale() {
		return this.tickScale;
	},

	/**
	 * Set loading state
	 * @param	{Boolean}	loading
	 */
	set loading(loading) {
		this.timeline.graph.loading.style.display = loading ? null : "none";
		this.isLoading = loading;
	},

	get loading() {
		return this.isLoading;
	},

	/**
	 * Get current tick based on current time.
	 * @return	{Number}
	 */
	get tick() {
		return (this.time - this.offset) / this.timePerBeat;
	},

	/**
	 * Get maximum ticks
	 * @return	{Number}
	 */
	get ticks() {
		return this.audio.duration / this.timePerBeat;
	},

	get graphWidth() {
		return this.timeline.graph.preview.clientWidth;
	},

	get timelineDuration() {
		return (this.graphWidth / (this.scale / 2)) * this.timePerBeat;
	}
}