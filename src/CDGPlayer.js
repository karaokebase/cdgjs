import { CDGDecoder } from "./CDGDecoder.js";

/**
 * @typedef {Object} TrackOptions
 * @property {string} audioFilePrefix - Prefix of the audio file (required)
 * @property {string} [cdgFilePrefix] - Prefix of the CDG file; defaults to audioFilePrefix
 * @property {string} [mediaPath=''] - Path to the directory containing media files
 * @property {'mp3'|'ogg'} [audioFormat='mp3'] - Audio format
 * @property {string} [cdgFileExtension='cdg'] - CDG file extension
 */

class CDGPlayer {
  static #UPDATE_INTERVAL_MS = 20; // Canvas refresh rate.

  static #defaults = {
    mediaPath: "",
    audioFormat: "mp3",
    cdgFileExtension: "cdg",
  };

  static #audioTypes = {
    mp3: 'audio/mpeg; codecs="mp3"',
    ogg: 'audio/ogg; codecs="vorbis"',
  };

  #audioPlayer = null;
  #audioSourceElement = null;
  #cdgIntervalID = null;
  #cdgDecoder = null;
  #loadingEl = null;
  #listeners = {};

  constructor(containerId, initOptions) {
    this.#init(containerId, initOptions);
  }

  /**
   * Loads a CDG track into the player using a streaming fetch so that lyrics
   * begin rendering as soon as the first bytes arrive rather than waiting for
   * the full file to download.
   * @param {string|TrackOptions} trackOptions - Track filename prefix or full options object
   * @returns {Promise<CDGPlayer>}
   */
  async loadTrack(trackOptions) {
    const trackInfo = this.#parseTrackOptions(trackOptions);
    this.#clearCDGInterval();
    if (this.#audioSourceElement == null) {
      this.#audioSourceElement = document.createElement("source");
    }
    this.#audioSourceElement.type =
      CDGPlayer.#audioTypes[trackInfo.audioFormat];
    this.#audioSourceElement.src =
      trackInfo.mediaPath +
      trackInfo.audioFilePrefix +
      "." +
      trackInfo.audioFormat;
    this.#audioPlayer.appendChild(this.#audioSourceElement);
    this.#audioPlayer.load();
    try {
      const cdgUrl =
        trackInfo.mediaPath +
        trackInfo.cdgFilePrefix +
        "." +
        trackInfo.cdgFileExtension;
      const response = await fetch(cdgUrl);
      if (!response.ok) {
        throw new Error(`CDG file failed to load: ${response.status}`);
      }
      // Initialise the decoder immediately so the audio interval has a valid
      // (empty) buffer before the first chunk arrives.
      this.#cdgDecoder.setCdgData(new Uint8Array(0));
      this.#showLoading();
      const reader = response.body.getReader();
      let received = new Uint8Array(0);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Grow the accumulation buffer and hand the new view to the decoder.
        const next = new Uint8Array(received.length + value.length);
        next.set(received);
        next.set(value, received.length);
        received = next;
        this.#cdgDecoder.updateCdgBuffer(received);
        this.#hideLoading();
      }
    } catch (error) {
      this.#emit("error", error);
    }
    this.#hideLoading();
    return this;
  }

  /**
   * Registers an event handler on the player.
   * @param {string} event - Event name ('error' | 'ended')
   * @param {Function} handler - Handler function
   * @returns {CDGPlayer}
   */
  on(event, handler) {
    if (!this.#listeners[event]) {
      this.#listeners[event] = [];
    }
    this.#listeners[event].push(handler);
    return this;
  }

  /** @returns {void} */
  pause() {
    this.#audioPlayer.pause();
  }

  /** @returns {void} */
  play() {
    this.#audioPlayer.play();
  }

  /** @returns {void} */
  stop() {
    this.#audioPlayer.pause();
    this.#audioPlayer.currentTime = 0;
  }

  #emit(event, ...args) {
    if (this.#listeners[event] && this.#listeners[event].length > 0) {
      for (const handler of this.#listeners[event]) {
        handler(...args);
      }
    } else if (event === "error") {
      console.error(...args);
    }
  }

  #showLoading() {
    if (this.#loadingEl) {
      this.#loadingEl.style.display = "";
    }
  }

  #hideLoading() {
    if (this.#loadingEl) {
      this.#loadingEl.style.display = "none";
    }
  }

  #handleAudioError() {
    if (this.#audioPlayer.error) {
      const errorResult = this.#audioPlayer.error.code
        ? this.#audioPlayer.error.code
        : this.#audioPlayer.error;
      this.#emit(
        "error",
        new Error(
          "The audio control fired an error event. Could be: " + errorResult,
        ),
      );
    }
  }

  #setCDGInterval() {
    this.#cdgIntervalID = setInterval(() => {
      this.#cdgDecoder.updateFrame(this.#audioPlayer.currentTime);
    }, CDGPlayer.#UPDATE_INTERVAL_MS);
  }

  #clearCDGInterval() {
    clearInterval(this.#cdgIntervalID);
  }

  #parseTrackOptions(trackOptions) {
    if (
      !trackOptions ||
      Array.isArray(trackOptions) ||
      (typeof trackOptions !== "string" && typeof trackOptions !== "object")
    ) {
      throw new Error("No track information specified, nothing to load!");
    }
    const defaults = CDGPlayer.#defaults;
    // String shorthand: use the same prefix for both audio and CDG files.
    if (typeof trackOptions === "string") {
      return {
        audioFilePrefix: trackOptions,
        cdgFilePrefix: trackOptions,
        mediaPath: defaults.mediaPath,
        audioFormat: defaults.audioFormat,
        cdgFileExtension: defaults.cdgFileExtension,
      };
    }
    if (!trackOptions.audioFilePrefix) {
      throw new Error("No audioFilePrefix property defined, nothing to load!");
    }
    if (
      trackOptions.audioFormat &&
      !CDGPlayer.#audioTypes[trackOptions.audioFormat]
    ) {
      throw new Error("Unsupported audio format specified");
    }
    return {
      audioFilePrefix: trackOptions.audioFilePrefix,
      cdgFilePrefix: trackOptions.cdgFilePrefix ?? trackOptions.audioFilePrefix,
      mediaPath: trackOptions.mediaPath ?? defaults.mediaPath,
      audioFormat: trackOptions.audioFormat ?? defaults.audioFormat,
      cdgFileExtension:
        trackOptions.cdgFileExtension ?? defaults.cdgFileExtension,
    };
  }

  #toggleFullscreen(e) {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      e.target.requestFullscreen();
    }
  }

  #togglePlay() {
    if (this.#audioPlayer.paused) {
      this.#audioPlayer.play();
    } else {
      this.#audioPlayer.pause();
    }
  }

  #init(containerId, initOptions = {}) {
    if (!containerId) {
      throw new Error("Required initialisation parameter missing.");
    }
    const containerEl = document.getElementById(containerId);
    const borderEl = document.createElement("div");
    const canvasEl = document.createElement("canvas");
    this.#audioPlayer = document.createElement("audio");
    borderEl.id = containerId + "-border";
    borderEl.className = "cdg-border";
    canvasEl.id = containerId + "-canvas";
    canvasEl.className = "cdg-canvas";
    const defaultConfig = {
      allowClickToPlay: true,
      allowFullscreen: true,
      autoplay: true,
      showControls: true,
      showLoadingIndicator: true,
    };
    const config = {
      ...defaultConfig,
      ...initOptions,
    };
    if (config.allowClickToPlay) {
      canvasEl.addEventListener("click", () => this.#togglePlay(), true);
    }
    if (config.allowFullscreen) {
      canvasEl.addEventListener(
        "dblclick",
        (e) => this.#toggleFullscreen(e),
        true,
      );
    }
    if (config.showLoadingIndicator) {
      this.#loadingEl = document.createElement("div");
      this.#loadingEl.id = containerId + "-loading";
      this.#loadingEl.className = "cdg-loading";
      this.#loadingEl.style.display = "none";
      borderEl.appendChild(this.#loadingEl);
    }
    this.#audioPlayer.id = containerId + "-audio";
    this.#audioPlayer.className = "cdg-audio";
    borderEl.appendChild(canvasEl);
    containerEl.appendChild(borderEl);
    containerEl.appendChild(this.#audioPlayer);
    this.#audioPlayer.style.width = canvasEl.offsetWidth + "px";
    this.#audioPlayer.controls = config.showControls;
    this.#audioPlayer.autoplay = config.autoplay;
    const audioListeners = {
      error: () => this.#handleAudioError(),
      play: () => this.#setCDGInterval(),
      pause: () => this.#clearCDGInterval(),
      abort: () => this.#clearCDGInterval(),
      ended: () => {
        this.#clearCDGInterval();
        this.#emit("ended");
      },
    };
    for (const [event, handler] of Object.entries(audioListeners)) {
      this.#audioPlayer.addEventListener(event, handler, true);
    }
    this.#cdgDecoder = new CDGDecoder(canvasEl, borderEl);
  }
}

export { CDGPlayer };
