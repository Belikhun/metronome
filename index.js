
const main = {
	container: $("#app"),

	audios: [
		{ path: "audios/Let Me Go.mp3", bpm: 170, offset: 0.177 },
		{ path: "audios/Viva Happy.mp3", bpm: 148, offset: -0.02, time: 54.9 },
		{ path: "audios/Tell Me Baby feat. mow 2.mp3", bpm: 170, offset: 0.540, time: 66.84 },
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
			label: { tag: "label", text: "Bảng Điều Khiển (kind of)" },
			audios: { tag: "div", class: "audios" },

			file: { tag: "div", class: "loadFile", child: {
				input: { tag: "input", type: "file" },
				load: createButton("LOAD", { style: "round", complex: true })
			}},

			note: createNote({
				level: "info",
				style: "round",
				message: `
					<h4>Phím tắt</h4>
					<ul>
						<li><code>Phím Cách</code>: tiếp tục/tạm dừng</li>
						<li><code>S</code>: dừng lại</li>
						<li><code>Lăn Chuột</code> tại timeline: đổi thời gian</li>
						<li><code>Ctrl + Lăn Chuột</code> tại timeline: phóng to/thu nhỏ</li>
						<li><code>Mũi Tên Phải</code>: tick tiếp theo</li>
						<li><code>Mũi Tên Trái</code>: tick trước đó</li>
					</ul>`
			})
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

		this.view.file.load.addEventListener("click", async () => {
			let file = this.view.file.input.files[0]

			if (!file)
				return;

			this.view.file.load.loading(true);

			try {
				await metronome.load(file);
				metronome.bpm = 60;
				metronome.offset = 0;

				if (this.active) {
					this.active.classList.remove("active");
					this.active = undefined;
				}
			} catch(e) {
				errorHandler(e);
				clog("ERRR", e);
			}

			this.view.file.load.loading(false);
		});
	}
}

initGroup({ main }, "core");