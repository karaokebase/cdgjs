// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CDGPlayer } from "../src/CDGPlayer.js";
import { CDGDecoder } from "../src/CDGDecoder.js";

vi.mock("../src/CDGDecoder.js", () => ({
  CDGDecoder: vi.fn().mockImplementation(function () {
    this.setCdgData = vi.fn();
    this.updateFrame = vi.fn();
  }),
}));

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

    it("calls setCdgData on the decoder when fetch succeeds", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("cdg-payload"),
      }));
      const player = createPlayer();
      await player.loadTrack("song");
      expect(CDGDecoder.mock.instances[0].setCdgData).toHaveBeenCalledWith("cdg-payload");
    });

    it("returns the player for chaining", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(""),
      }));
      const player = createPlayer();
      expect(await player.loadTrack("song")).toBe(player);
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
