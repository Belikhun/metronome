
const main = {
	container: $("#app"),

	audios: [
		{ path: "audios/Let Me Go.mp3", bpm: 170, offset: 0.177 },
		{ path: "audios/Viva Happy.mp3", bpm: 148, offset: -0.02 },
		{ path: "audios/Tell Me Baby feat. mow 2.mp3", bpm: 170, offset: 0.177 },
		{ path: "audios/Artificial Snow.mp3", bpm: 256, offset: 1.416 },
		{ path: "audios/test60.mp3", bpm: 60, offset: 0.130 },
		{ path: "audios/metro_170bpm_5min.mp3", bpm: 170, offset: 0 }
	],

	/** @type {HTMLElement} */
	active: undefined,

	/** @type {TreeDOM} */
	view: undefined,

	async init() {
		window.DEBUG = false;

		popup.init();
		await metronome.init(this.container, { scale: 80 });

		this.view = makeTree("div", "MetronomeControlPanel", {
			label: { tag: "label", text: "Control Panel" },
			audios: { tag: "div", class: "audios" },

			file: { tag: "div", class: "loadFile", child: {
				input: { tag: "input", type: "file" },
				load: createButton("LOAD", { complex: true })
			}}
		});

		// Inject our own panel
		metronome.view.panels.appendChild(this.view);

		// Render audios
		for (let item of this.audios) {
			let node = makeTree("div", "audio", {
				path: { tag: "span", text: item.path },
				bpm: { tag: "tag", text: `${item.bpm} BPM` }
			});

			this.view.audios.appendChild(node);
			node.addEventListener("click", async () => {
				if (this.active)
					this.active.classList.remove("active");

				await metronome.load(item.path);
				metronome.bpm = item.bpm || 60;
				metronome.offset = item.offset || 0;

				if (item.time)
					metronome.time = item.time;

				node.classList.add("active");
				this.active = node;
			});
		}
	}
}

initGroup({ main }, "core");