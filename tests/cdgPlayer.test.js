// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CDGPlayer } from "../src/CDGPlayer.js";
import { CDGDecoder } from "../src/CDGDecoder.js";
import { init } from "../src/cdg.js";

vi.mock("../src/CDGDecoder.js", () => ({
  CDGDecoder: vi.fn().mockImplementation(function () {
    this.setCdgData = vi.fn();
    this.updateCdgBuffer = vi.fn();
    this.updateFrame = vi.fn();
  }),
}));

// Returns a minimal streaming fetch mock that yields the given chunks then closes.
function makeStreamingFetch(chunks = []) {
  let index = 0;
  return vi.fn().mockResolvedValue({
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn().mockImplementation(() => {
          if (index < chunks.length) {
            return Promise.resolve({ done: false, value: chunks[index++] });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
}

// jsdom does not implement media element methods.
HTMLAudioElement.prototype.load = vi.fn();
HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue(undefined);
HTMLAudioElement.prototype.pause = vi.fn();

function createPlayer(id = "player", initOptions) {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return new CDGPlayer(id, initOptions);
}

describe("CDGPlayer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  });

  // ── constructor ──────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("throws when containerId is missing", () => {
      expect(() => new CDGPlayer("")).toThrow("Required initialisation parameter missing.");
    });

    it("creates border, canvas, and audio elements inside the container", () => {
      createPlayer();
      expect(document.getElementById("player-border")).not.toBeNull();
      expect(document.getElementById("player-canvas")).not.toBeNull();
      expect(document.getElementById("player-audio")).not.toBeNull();
    });

    it("assigns correct CSS classes", () => {
      createPlayer();
      expect(document.getElementById("player-border").className).toBe("cdg-border");
      expect(document.getElementById("player-canvas").className).toBe("cdg-canvas");
      expect(document.getElementById("player-audio").className).toBe("cdg-audio");
    });
  });

  // ── init() public factory ────────────────────────────────────────────────────

  describe("init()", () => {
    it("creates and returns a CDGPlayer via the cdg.js public entry point", () => {
      const el = document.createElement("div");
      el.id = "init-player";
      document.body.appendChild(el);
      const player = init("init-player");
      expect(player).toBeInstanceOf(CDGPlayer);
    });
  });

  // ── initOptions ──────────────────────────────────────────────────────────────

  describe("initOptions", () => {
    it("shows controls by default", () => {
      createPlayer();
      expect(document.getElementById("player-audio").controls).toBe(true);
    });

    it("hides controls when showControls is false", () => {
      createPlayer("player", { showControls: false });
      expect(document.getElementById("player-audio").controls).toBe(false);
    });

    it("enables autoplay by default", () => {
      createPlayer();
      expect(document.getElementById("player-audio").autoplay).toBe(true);
    });

    it("disables autoplay when autoplay is false", () => {
      createPlayer("player", { autoplay: false });
      expect(document.getElementById("player-audio").autoplay).toBe(false);
    });
  });

  // ── on() / event emission ────────────────────────────────────────────────────

  describe("on()", () => {
    it("returns the player for chaining", () => {
      const player = createPlayer();
      expect(player.on("ended", () => {})).toBe(player);
    });

    it("calls a registered ended handler when audio ends", () => {
      const player = createPlayer();
      const handler = vi.fn();
      player.on("ended", handler);
      document.getElementById("player-audio").dispatchEvent(new Event("ended"));
      expect(handler).toHaveBeenCalledOnce();
    });

    it("calls all handlers registered for the same event", () => {
      const player = createPlayer();
      const h1 = vi.fn(), h2 = vi.fn();
      player.on("ended", h1).on("ended", h2);
      document.getElementById("player-audio").dispatchEvent(new Event("ended"));
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("falls back to console.error for unhandled error events", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const player = createPlayer();
      await player.loadTrack("song");
      expect(spy).toHaveBeenCalled();
    });

    it("silently ignores unhandled non-error events", () => {
      createPlayer();
      // Dispatch "ended" with no registered listener: #emit("ended") should reach
      // the false branch of `else if (event === "error")` without throwing.
      expect(() =>
        document.getElementById("player-audio").dispatchEvent(new Event("ended")),
      ).not.toThrow();
    });
  });

  // ── loadTrack — input validation ──────────────────────────────────────────────

  describe("loadTrack — input validation", () => {
    it("rejects when trackOptions is null", async () => {
      await expect(createPlayer().loadTrack(null)).rejects.toThrow("No track information specified");
    });

    it("rejects when trackOptions is an array", async () => {
      await expect(createPlayer().loadTrack([])).rejects.toThrow("No track information specified");
    });

    it("rejects when trackOptions is a number", async () => {
      await expect(createPlayer().loadTrack(42)).rejects.toThrow("No track information specified");
    });

    it("rejects when audioFilePrefix is missing", async () => {
      await expect(createPlayer().loadTrack({})).rejects.toThrow("No audioFilePrefix property defined");
    });

    it("rejects when audioFormat is unsupported", async () => {
      await expect(
        createPlayer().loadTrack({ audioFilePrefix: "song", audioFormat: "flac" }),
      ).rejects.toThrow("Unsupported audio format");
    });
  });

  // ── loadTrack — URL construction ─────────────────────────────────────────────

  describe("loadTrack — URL construction", () => {
    it("fetches <prefix>.cdg when given a string", async () => {
      const player = createPlayer();
      player.on("error", vi.fn());
      await player.loadTrack("mysong");
      expect(fetch).toHaveBeenCalledWith("mysong.cdg");
    });

    it("uses cdgFilePrefix separately when provided", async () => {
      const player = createPlayer();
      player.on("error", vi.fn());
      await player.loadTrack({ audioFilePrefix: "audio/song", cdgFilePrefix: "cdg/song" });
      expect(fetch).toHaveBeenCalledWith("cdg/song.cdg");
    });

    it("defaults cdgFilePrefix to audioFilePrefix", async () => {
      const player = createPlayer();
      player.on("error", vi.fn());
      await player.loadTrack({ audioFilePrefix: "song" });
      expect(fetch).toHaveBeenCalledWith("song.cdg");
    });

    it("prepends mediaPath to the CDG URL", async () => {
      const player = createPlayer();
      player.on("error", vi.fn());
      await player.loadTrack({ audioFilePrefix: "track", mediaPath: "/media/" });
      expect(fetch).toHaveBeenCalledWith("/media/track.cdg");
    });

    it("uses a custom cdgFileExtension", async () => {
      const player = createPlayer();
      player.on("error", vi.fn());
      await player.loadTrack({ audioFilePrefix: "track", cdgFileExtension: "cdg2" });
      expect(fetch).toHaveBeenCalledWith("track.cdg2");
    });
  });

  // ── loadTrack — success / failure ────────────────────────────────────────────

  describe("loadTrack — outcomes", () => {
    it("emits error when CDG fetch fails", async () => {
      const player = createPlayer();
      const errorHandler = vi.fn();
      player.on("error", errorHandler);
      await player.loadTrack("song");
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("404") }),
      );
    });

    it("initialises the decoder with an empty buffer then streams chunks via updateCdgBuffer", async () => {
      const chunk = new Uint8Array([1, 2, 3, 4]);
      vi.stubGlobal("fetch", makeStreamingFetch([chunk]));
      const player = createPlayer();
      await player.loadTrack("song");
      const decoder = CDGDecoder.mock.instances[0];
      // setCdgData called once with an empty Uint8Array to reset state
      expect(decoder.setCdgData).toHaveBeenCalledWith(new Uint8Array(0));
      // updateCdgBuffer called with the accumulated bytes from the stream
      expect(decoder.updateCdgBuffer).toHaveBeenCalledWith(chunk);
    });

    it("accumulates multiple chunks before each updateCdgBuffer call", async () => {
      const chunk1 = new Uint8Array([1, 2]);
      const chunk2 = new Uint8Array([3, 4]);
      vi.stubGlobal("fetch", makeStreamingFetch([chunk1, chunk2]));
      const player = createPlayer();
      await player.loadTrack("song");
      const calls = CDGDecoder.mock.instances[0].updateCdgBuffer.mock.calls;
      // Second call must include all bytes received so far
      expect(calls[calls.length - 1][0]).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it("returns the player for chaining", async () => {
      vi.stubGlobal("fetch", makeStreamingFetch([]));
      const player = createPlayer();
      expect(await player.loadTrack("song")).toBe(player);
    });
  });

  // ── loading indicator ─────────────────────────────────────────────────────────

  describe("loading indicator", () => {
    it("creates a cdg-loading element inside the border by default", () => {
      createPlayer();
      expect(document.getElementById("player-loading")).not.toBeNull();
      expect(document.getElementById("player-loading").className).toBe("cdg-loading");
    });

    it("does not create the loading element when showLoadingIndicator is false", () => {
      createPlayer("player", { showLoadingIndicator: false });
      expect(document.getElementById("player-loading")).toBeNull();
    });

    it("shows the loading element while the stream is in progress and hides it when done", async () => {
      let resolveRead;
      const pendingRead = new Promise((r) => { resolveRead = r; });
      let callCount = 0;
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (callCount++ === 0) return pendingRead;
              return Promise.resolve({ done: true, value: undefined });
            }),
          }),
        },
      }));

      const player = createPlayer();
      const loadingEl = document.getElementById("player-loading");

      const trackPromise = player.loadTrack("song");
      // Yield to the event loop so loadTrack runs up to the first reader.read() await.
      await Promise.resolve();
      expect(loadingEl.style.display).toBe(""); // visible while waiting for chunk

      resolveRead({ done: false, value: new Uint8Array([0]) });
      await trackPromise;
      expect(loadingEl.style.display).toBe("none"); // hidden once stream is done
    });
  });

  // ── play / pause / stop ───────────────────────────────────────────────────────

  describe("play()", () => {
    it("delegates to the audio element", () => {
      createPlayer().play();
      expect(HTMLAudioElement.prototype.play).toHaveBeenCalledOnce();
    });
  });

  describe("pause()", () => {
    it("delegates to the audio element", () => {
      createPlayer().pause();
      expect(HTMLAudioElement.prototype.pause).toHaveBeenCalledOnce();
    });
  });

  describe("stop()", () => {
    it("pauses and resets currentTime to zero", () => {
      const player = createPlayer();
      const audio = document.getElementById("player-audio");
      audio.currentTime = 10;
      player.stop();
      expect(HTMLAudioElement.prototype.pause).toHaveBeenCalledOnce();
      expect(audio.currentTime).toBe(0);
    });
  });

  // ── #handleAudioError ────────────────────────────────────────────────────────

  describe("#handleAudioError", () => {
    it("emits an error containing the error code when code is set", () => {
      const player = createPlayer();
      const errorHandler = vi.fn();
      player.on("error", errorHandler);
      Object.defineProperty(document.getElementById("player-audio"), "error", {
        get: () => ({ code: 3 }),
        configurable: true,
      });
      document.getElementById("player-audio").dispatchEvent(new Event("error"));
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("3") }),
      );
    });

    it("emits an error using the error object when code is absent", () => {
      const player = createPlayer();
      const errorHandler = vi.fn();
      player.on("error", errorHandler);
      const audioError = { toString: () => "decode error" };
      Object.defineProperty(document.getElementById("player-audio"), "error", {
        get: () => audioError,
        configurable: true,
      });
      document.getElementById("player-audio").dispatchEvent(new Event("error"));
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("decode error") }),
      );
    });

    it("does not emit when audioPlayer.error is null", () => {
      const player = createPlayer();
      const errorHandler = vi.fn();
      player.on("error", errorHandler);
      // audio.error is null by default in jsdom — #handleAudioError should be a no-op
      document.getElementById("player-audio").dispatchEvent(new Event("error"));
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  // ── #togglePlay ───────────────────────────────────────────────────────────────

  describe("#togglePlay (via canvas click)", () => {
    it("calls play() when audio is paused", () => {
      createPlayer();
      const audio = document.getElementById("player-audio");
      Object.defineProperty(audio, "paused", { get: () => true, configurable: true });
      document.getElementById("player-canvas").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(HTMLAudioElement.prototype.play).toHaveBeenCalledOnce();
    });

    it("calls pause() when audio is not paused", () => {
      createPlayer();
      const audio = document.getElementById("player-audio");
      Object.defineProperty(audio, "paused", { get: () => false, configurable: true });
      document.getElementById("player-canvas").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(HTMLAudioElement.prototype.pause).toHaveBeenCalledOnce();
    });

    it("does not add a click handler when allowClickToPlay is false", () => {
      createPlayer("player", { allowClickToPlay: false });
      const audio = document.getElementById("player-audio");
      Object.defineProperty(audio, "paused", { get: () => true, configurable: true });
      document.getElementById("player-canvas").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      expect(HTMLAudioElement.prototype.play).not.toHaveBeenCalled();
    });
  });

  // ── #toggleFullscreen ─────────────────────────────────────────────────────────

  describe("#toggleFullscreen (via canvas dblclick)", () => {
    afterEach(() => {
      Object.defineProperty(document, "fullscreenElement", {
        get: () => null,
        configurable: true,
      });
      delete document.exitFullscreen;
    });

    it("calls document.exitFullscreen when already in fullscreen", () => {
      createPlayer();
      const exitFullscreen = vi.fn();
      Object.defineProperty(document, "fullscreenElement", {
        get: () => document.body,
        configurable: true,
      });
      document.exitFullscreen = exitFullscreen;
      document.getElementById("player-canvas").dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true }),
      );
      expect(exitFullscreen).toHaveBeenCalledOnce();
    });

    it("calls requestFullscreen on the canvas when not in fullscreen", () => {
      createPlayer();
      const canvas = document.getElementById("player-canvas");
      canvas.requestFullscreen = vi.fn();
      canvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      expect(canvas.requestFullscreen).toHaveBeenCalledOnce();
    });

    it("does not add a dblclick handler when allowFullscreen is false", () => {
      createPlayer("player", { allowFullscreen: false });
      const canvas = document.getElementById("player-canvas");
      canvas.requestFullscreen = vi.fn();
      canvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      expect(canvas.requestFullscreen).not.toHaveBeenCalled();
    });
  });

  // ── CDG update interval ───────────────────────────────────────────────────────

  describe("CDG update interval", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("calls updateFrame on each tick while audio is playing", () => {
      createPlayer();
      document.getElementById("player-audio").dispatchEvent(new Event("play"));
      vi.advanceTimersByTime(20);
      expect(CDGDecoder.mock.instances[0].updateFrame).toHaveBeenCalled();
    });

    it("stops calling updateFrame after audio is aborted", () => {
      createPlayer();
      const audio = document.getElementById("player-audio");
      audio.dispatchEvent(new Event("play"));
      audio.dispatchEvent(new Event("abort"));
      const callCount = CDGDecoder.mock.instances[0].updateFrame.mock.calls.length;
      vi.advanceTimersByTime(100);
      expect(CDGDecoder.mock.instances[0].updateFrame.mock.calls.length).toBe(callCount);
    });

    it("stops calling updateFrame after audio pauses", () => {
      createPlayer();
      const audio = document.getElementById("player-audio");
      audio.dispatchEvent(new Event("play"));
      audio.dispatchEvent(new Event("pause"));
      const callCount = CDGDecoder.mock.instances[0].updateFrame.mock.calls.length;
      vi.advanceTimersByTime(100);
      expect(CDGDecoder.mock.instances[0].updateFrame.mock.calls.length).toBe(callCount);
    });
  });
});
