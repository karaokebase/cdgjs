/*!
*  cdgjs - a CD+G player for the web, based upon CD+Graphics Magic HTML5 CD+G Player
*  (http://cdgmagic.sourceforge.net/html5_cdgplayer/). Visit project for full license
*  information and documentation: https://github.com/karaokebase/cdgjs
*/
//#region src/CDGDecoder.js
var e = class e {
	static #e = {
		VRAM_HEIGHT: 216,
		VISIBLE_WIDTH: 288,
		VISIBLE_HEIGHT: 192,
		FONT_WIDTH: 6,
		FONT_HEIGHT: 12,
		NUM_X_FONTS: 50,
		NUM_Y_FONTS: 18,
		VISIBLE_X_FONTS: 48,
		VISIBLE_Y_FONTS: 16,
		PALETTE_ENTRIES: 16,
		CLUT_ENTRIES: 8,
		PACK_SIZE: 24,
		PACKS_PER_SECOND: 300,
		TV_GRAPHICS: 9,
		MEMORY_PRESET: 1,
		BORDER_PRESET: 2,
		LOAD_CLUT_LO: 30,
		LOAD_CLUT_HI: 31,
		COPY_FONT: 6,
		XOR_FONT: 38,
		SCROLL_PRESET: 20,
		SCROLL_COPY: 24,
		SMOOTHING_PACKS: 6
	};
	static #t = [
		0,
		4,
		8,
		12,
		16,
		20
	];
	#n;
	#r;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l = null;
	#u = 0;
	#d = 0;
	#f = 0;
	#p = !1;
	#m = !1;
	constructor(t, n) {
		let r = e.#e;
		this.#n = n, this.#r = t.getContext("2d"), this.#i = this.#r.createImageData(r.VISIBLE_WIDTH, r.VISIBLE_HEIGHT), this.#a = new Uint32Array(r.PALETTE_ENTRIES), this.#o = new Uint32Array(r.NUM_X_FONTS * r.VRAM_HEIGHT), this.#s = new Uint8Array(r.NUM_X_FONTS * r.NUM_Y_FONTS), this.#c = new Uint32Array(r.NUM_X_FONTS * r.FONT_HEIGHT), t.width = r.VISIBLE_WIDTH, t.height = r.VISIBLE_HEIGHT, this.#h();
	}
	setCdgData(t) {
		this.#l = t, this.#u = Math.floor(t.length / e.#e.PACK_SIZE), this.#h(), this.#g();
	}
	updateCdgBuffer(t) {
		this.#l = t, this.#u = Math.floor(t.length / e.#e.PACK_SIZE);
	}
	updateFrame(t) {
		let n = e.#e, r = Math.floor(t * n.PACKS_PER_SECOND), i;
		r = Math.max(r, 0), r < this.#f - n.PACKS_PER_SECOND && (this.#h(), this.#f = 0), i = this.#f + n.SMOOTHING_PACKS, i = Math.max(r, i), i > this.#f && (this.#_(i), this.#g());
	}
	#h() {
		this.#f = 0, this.#d = 0, this.#a.fill(0), this.#b(0), this.#s.fill(0);
	}
	#g() {
		let t = e.#e;
		if ((this.#p || this.#m) && (this.#n.style.backgroundColor = this.#v(this.#d), this.#p = !1), this.#m) this.#S(), this.#m = !1, this.#s.fill(0), this.#r.putImageData(this.#i, 0, 0);
		else {
			let e = this.#r, n = this.#i, r = this.#s, i;
			for (let a = 1; a <= t.VISIBLE_Y_FONTS; ++a) {
				i = a * t.NUM_X_FONTS + 1;
				for (let o = 1; o <= t.VISIBLE_X_FONTS; ++o) r[i] && (this.#C(o, a), e.putImageData(n, 0, 0, (o - 1) * t.FONT_WIDTH, (a - 1) * t.FONT_HEIGHT, t.FONT_WIDTH, t.FONT_HEIGHT), r[i] = 0), ++i;
			}
		}
	}
	#_(t) {
		let n = e.#e, r = Math.min(t, this.#u);
		for (let e = this.#f; e < r; e++) {
			let t = e * n.PACK_SIZE;
			if ((this.#l[t] & 63) === n.TV_GRAPHICS) {
				let e = this.#l.subarray(t, t + n.PACK_SIZE);
				switch (e[1] & 63) {
					case n.MEMORY_PRESET:
						this.#T(e);
						break;
					case n.BORDER_PRESET:
						this.#w(e);
						break;
					case n.LOAD_CLUT_LO:
					case n.LOAD_CLUT_HI:
						this.#E(e);
						break;
					case n.COPY_FONT:
					case n.XOR_FONT:
						this.#D(e);
						break;
					case n.SCROLL_PRESET:
					case n.SCROLL_COPY:
						this.#k(e);
						break;
				}
			}
		}
		this.#f = r;
	}
	#v(e) {
		let t = this.#a;
		return "rgb(" + (t[e] >> 16 & 255) + "," + (t[e] >> 8 & 255) + "," + (t[e] & 255) + ")";
	}
	#y(e) {
		let t = e;
		return t |= e << 4, t |= e << 8, t |= e << 12, t |= e << 16, t |= e << 20, t;
	}
	#b(e) {
		this.#o.fill(this.#y(e)), this.#m = !0;
	}
	#x(t, n, r, i) {
		let a = e.#t;
		for (let e = 0; e < 6; e++) {
			let o = r[i >> a[e] & 15];
			t[n++] = o >> 16 & 255, t[n++] = o >> 8 & 255, t[n++] = o & 255, t[n++] = 255;
		}
		return n;
	}
	#S() {
		let t = e.#e, n = this.#i.data, r = this.#a, i = this.#o, a = t.NUM_X_FONTS * t.FONT_HEIGHT + 1, o = 0;
		for (let e = 0; e < t.VISIBLE_HEIGHT; ++e) {
			for (let e = 0; e < t.VISIBLE_X_FONTS; ++e) o = this.#x(n, o, r, i[a++]);
			a += t.NUM_X_FONTS - t.VISIBLE_X_FONTS;
		}
	}
	#C(t, n) {
		let r = e.#e, i = this.#i.data, a = this.#a, o = this.#o, s = n * r.NUM_X_FONTS * r.FONT_HEIGHT + t, c = r.NUM_X_FONTS, l = s + r.NUM_X_FONTS * r.FONT_HEIGHT, u = (n - 1) * r.FONT_HEIGHT * r.VISIBLE_WIDTH;
		u += (t - 1) * r.FONT_WIDTH, u *= 4;
		let d = (r.VISIBLE_WIDTH - r.FONT_WIDTH) * 4;
		for (; s < l;) u = this.#x(i, u, a, o[s]), s += c, u += d;
	}
	#w(e) {
		let t = e[4] & 63;
		this.#a[t] != this.#a[this.#d] && (this.#p = !0), this.#d = t;
	}
	#T(e) {
		this.#b(e[4] & 63);
	}
	#E(t) {
		let n = e.#e, r = this.#a, i = (t[1] & 1) * n.CLUT_ENTRIES;
		for (let e = 0; e < n.CLUT_ENTRIES; e++) {
			let n = e + i, a = 0, o = (t[e * 2 + 4] & 60) >> 2;
			a |= o * 17 << 16, o = (t[e * 2 + 4] & 3) << 2 | (t[e * 2 + 5] & 48) >> 4, a |= o * 17 << 8, o = t[e * 2 + 5] & 15, a |= o * 17, a != r[n] && (r[n] = a, this.#m = !0, n == this.#d && (this.#p = !0));
		}
	}
	#D(t) {
		let n = e.#e, r = this.#o, i = this.#s;
		if (!(3 >> ((t[4] & 48) >> 2 | (t[5] & 48) >> 4) & 1)) return;
		let a = t[7] & 63, o = t[6] & 31;
		if (a >= n.NUM_X_FONTS || o >= n.NUM_Y_FONTS) return;
		let s = t[1] & 32, c = o * n.NUM_X_FONTS * n.FONT_HEIGHT + a, l = t[4] & 15, u = t[5] & 15;
		for (let e = 0; e < n.FONT_HEIGHT; e++) {
			let i = e * n.NUM_X_FONTS + c, a = this.#O(t[e + 8], l, u);
			s ? r[i] ^= a : r[i] = a;
		}
		i[o * n.NUM_X_FONTS + a] = 1;
	}
	#O(e, t, n) {
		let r = e & 32 ? n : t;
		return r |= (e & 16 ? n : t) << 4, r |= (e & 8 ? n : t) << 8, r |= (e & 4 ? n : t) << 12, r |= (e & 2 ? n : t) << 16, r |= (e & 1 ? n : t) << 20, r;
	}
	#k(e) {
		let t = (e[1] & 8) >> 3, n = e[4] & 15, r = (e[5] & 48) >> 4, i = (e[6] & 48) >> 4;
		r && this.#A(r, t, n), i && this.#N(i, t, n), this.#m = !0;
	}
	#A(e, t, n) {
		let r = this.#y(n);
		e === 2 ? this.#j(t, r) : e === 1 && this.#M(t, r);
	}
	#j(t, n) {
		let r = e.#e, i = this.#o, a = r.NUM_X_FONTS * r.VRAM_HEIGHT;
		for (let e = 0; e < a; e += r.NUM_X_FONTS) {
			let a = i[e];
			for (let t = e + 1; t < e + r.NUM_X_FONTS; t++) i[t - 1] = i[t];
			i[e + r.NUM_X_FONTS - 1] = t ? a : n;
		}
	}
	#M(t, n) {
		let r = e.#e, i = this.#o, a = r.NUM_X_FONTS * r.VRAM_HEIGHT;
		for (let e = 0; e < a; e += r.NUM_X_FONTS) {
			let a = i[e + r.NUM_X_FONTS - 1];
			for (let t = e + r.NUM_X_FONTS - 2; t >= e; t--) i[t + 1] = i[t];
			i[e] = t ? a : n;
		}
	}
	#N(e, t, n) {
		let r = this.#y(n);
		e === 2 ? this.#P(t, r) : e === 1 && this.#F(t, r);
	}
	#P(t, n) {
		let r = e.#e, i = r.NUM_X_FONTS * r.FONT_HEIGHT, a = r.NUM_X_FONTS * r.VRAM_HEIGHT, o = r.NUM_X_FONTS * (r.VRAM_HEIGHT - r.FONT_HEIGHT), s = this.#c, c = this.#o, l = 0;
		for (let e = 0; e < i; e++) s[l++] = c[e];
		l = 0;
		for (let e = i; e < a; e++) c[l++] = c[e];
		l = o;
		for (let e = 0; e < i; e++) c[l++] = t ? s[e] : n;
	}
	#F(t, n) {
		let r = e.#e, i = r.NUM_X_FONTS * r.FONT_HEIGHT, a = r.NUM_X_FONTS * r.VRAM_HEIGHT, o = r.NUM_X_FONTS * (r.VRAM_HEIGHT - r.FONT_HEIGHT), s = this.#c, c = this.#o, l = 0;
		for (let e = o; e < a; e++) s[l++] = c[e];
		for (let e = o - 1; e > 0; e--) c[e + i] = c[e];
		for (let e = 0; e < i; e++) c[e] = t ? s[e] : n;
	}
}, t = class t {
	static #e = 20;
	static #t = {
		mediaPath: "",
		audioFormat: "mp3",
		cdgFileExtension: "cdg"
	};
	static #n = {
		mp3: "audio/mpeg; codecs=\"mp3\"",
		ogg: "audio/ogg; codecs=\"vorbis\""
	};
	#r = null;
	#i = null;
	#a = null;
	#o = null;
	#s = null;
	#c = {};
	constructor(e, t) {
		this.#v(e, t);
	}
	async loadTrack(e) {
		let n = this.#h(e);
		this.#m(), this.#i ??= document.createElement("source"), this.#i.type = t.#n[n.audioFormat], this.#i.src = n.mediaPath + n.audioFilePrefix + "." + n.audioFormat, this.#r.appendChild(this.#i), this.#r.load();
		try {
			let e = n.mediaPath + n.cdgFilePrefix + "." + n.cdgFileExtension, t = await fetch(e);
			if (!t.ok) throw Error(`CDG file failed to load: ${t.status}`);
			this.#o.setCdgData(new Uint8Array()), this.#u();
			let r = t.body.getReader(), i = new Uint8Array();
			for (;;) {
				let { done: e, value: t } = await r.read();
				if (e) break;
				let n = new Uint8Array(i.length + t.length);
				n.set(i), n.set(t, i.length), i = n, this.#o.updateCdgBuffer(i), this.#d();
			}
		} catch (e) {
			this.#l("error", e);
		}
		return this.#d(), this;
	}
	on(e, t) {
		return this.#c[e] || (this.#c[e] = []), this.#c[e].push(t), this;
	}
	pause() {
		this.#r.pause();
	}
	play() {
		this.#r.play();
	}
	stop() {
		this.#r.pause(), this.#r.currentTime = 0;
	}
	#l(e, ...t) {
		if (this.#c[e] && this.#c[e].length > 0) for (let n of this.#c[e]) n(...t);
		else e === "error" && console.error(...t);
	}
	#u() {
		this.#s && (this.#s.style.display = "");
	}
	#d() {
		this.#s && (this.#s.style.display = "none");
	}
	#f() {
		if (this.#r.error) {
			let e = this.#r.error.code ? this.#r.error.code : this.#r.error;
			this.#l("error", /* @__PURE__ */ Error("The audio control fired an error event. Could be: " + e));
		}
	}
	#p() {
		this.#a = setInterval(() => {
			this.#o.updateFrame(this.#r.currentTime);
		}, t.#e);
	}
	#m() {
		clearInterval(this.#a);
	}
	#h(e) {
		if (!e || Array.isArray(e) || typeof e != "string" && typeof e != "object") throw Error("No track information specified, nothing to load!");
		let n = t.#t;
		if (typeof e == "string") return {
			audioFilePrefix: e,
			cdgFilePrefix: e,
			mediaPath: n.mediaPath,
			audioFormat: n.audioFormat,
			cdgFileExtension: n.cdgFileExtension
		};
		if (!e.audioFilePrefix) throw Error("No audioFilePrefix property defined, nothing to load!");
		if (e.audioFormat && !t.#n[e.audioFormat]) throw Error("Unsupported audio format specified");
		return {
			audioFilePrefix: e.audioFilePrefix,
			cdgFilePrefix: e.cdgFilePrefix ?? e.audioFilePrefix,
			mediaPath: e.mediaPath ?? n.mediaPath,
			audioFormat: e.audioFormat ?? n.audioFormat,
			cdgFileExtension: e.cdgFileExtension ?? n.cdgFileExtension
		};
	}
	#g(e) {
		document.fullscreenElement ? document.exitFullscreen?.() : e.target.requestFullscreen();
	}
	#_() {
		this.#r.paused ? this.#r.play() : this.#r.pause();
	}
	#v(t, n = {}) {
		if (!t) throw Error("Required initialisation parameter missing.");
		let r = document.getElementById(t), i = document.createElement("div"), a = document.createElement("canvas");
		this.#r = document.createElement("audio"), i.id = t + "-border", i.className = "cdg-border", a.id = t + "-canvas", a.className = "cdg-canvas";
		let o = {
			allowClickToPlay: !0,
			allowFullscreen: !0,
			autoplay: !0,
			showControls: !0,
			showLoadingIndicator: !0,
			...n
		};
		o.allowClickToPlay && a.addEventListener("click", () => this.#_(), !0), o.allowFullscreen && a.addEventListener("dblclick", (e) => this.#g(e), !0), o.showLoadingIndicator && (this.#s = document.createElement("div"), this.#s.id = t + "-loading", this.#s.className = "cdg-loading", this.#s.style.display = "none", i.appendChild(this.#s)), this.#r.id = t + "-audio", this.#r.className = "cdg-audio", i.appendChild(a), r.appendChild(i), r.appendChild(this.#r), this.#r.style.width = a.offsetWidth + "px", this.#r.controls = o.showControls, this.#r.autoplay = o.autoplay;
		let s = {
			error: () => this.#f(),
			play: () => this.#p(),
			pause: () => this.#m(),
			abort: () => this.#m(),
			ended: () => {
				this.#m(), this.#l("ended");
			}
		};
		for (let [e, t] of Object.entries(s)) this.#r.addEventListener(e, t, !0);
		this.#o = new e(a, i);
	}
};
//#endregion
//#region src/cdg.js
function n(e, n) {
	return new t(e, n);
}
//#endregion
export { e as CDGDecoder, n as init };

//# sourceMappingURL=cdg.js.map