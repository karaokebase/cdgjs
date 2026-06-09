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
  // True once the CDG file for the current track has fully downloaded.
  // play() is deferred until this flag is set.
  #cdgReady = true;
  // Set by play() when called while a CDG download is in progress.
  #pendingPlay = false;
  // Stored from initOptions so it can be applied after CDG is ready.
  #autoplay = false;

  constructor(containerId, initOptions) {
    this.#init(containerId, initOptions);
  }

  /**
   * Loads a CDG track into the player. Audio playback is intentionally held
   * until the CDG file has fully downloaded so that lyrics are always in sync
   * from the first frame, with no mid-song buffering pauses.
   * @param {string|TrackOptions} trackOptions - Track filename prefix or full options object
   * @returns {Promise<CDGPlayer>}
   */
  async loadTrack(trackOptions) {
    const trackInfo = this.#parseTrackOptions(trackOptions);
    this.#cdgReady = false;
    this.#pendingPlay = false;
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
    // Begin audio buffering in parallel with the CDG download so the audio
    // element is ready to play as soon as the CDG file arrives.
    this.#audioPlayer.load();
    this.#showLoading();
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
      // Fetch binary data directly to avoid any text-encoding mangling.
      const buffer = await response.arrayBuffer();
      this.#cdgDecoder.setCdgData(new Uint8Array(buffer));
      this.#cdgReady = true;
      this.#hideLoading();
      // Start audio if the user already clicked play, or if autoplay is on.
      if (this.#pendingPlay || this.#autoplay) {
        this.#pendingPlay = false;
        this.#audioPlayer.play();
      }
    } catch (error) {
      this.#hideLoading();
      this.#emit("error", error);
    }
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

  /**
   * Starts audio playback. If the CDG file is still downloading, the play
   * request is queued and executed automatically once the download completes.
   * @returns {void}
   */
  play() {
    if (this.#cdgReady) {
      this.#audioPlayer.play();
    } else {
      this.#pendingPlay = true;
    }
  }

  /** @returns {void} */
  stop() {
    this.#pendingPlay = false;
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
      this.play();
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
    this.#autoplay = config.autoplay;
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
    this.#audioPlayer.controls = config.showControls;
    borderEl.appendChild(canvasEl);
    containerEl.appendChild(borderEl);
    containerEl.appendChild(this.#audioPlayer);
    this.#audioPlayer.style.width = canvasEl.offsetWidth + "px";
    const audioListeners = {
      error: () => this.#handleAudioError(),
      play: () => {
        if (this.#cdgReady) {
          this.#setCDGInterval();
        } else {
          // The native audio controls started playback before the CDG file has
          // finished downloading. Pause immediately and queue the play request
          // so it fires automatically once the download completes.
          this.#audioPlayer.pause();
          this.#pendingPlay = true;
        }
      },
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
