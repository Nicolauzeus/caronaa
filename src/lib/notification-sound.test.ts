import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeOscillator = {
  type: string;
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: null | (() => void);
};

let oscillators: FakeOscillator[];
const unlock = { release: () => undefined };

function mockAudioContext(initialState: "running" | "suspended") {
  return class {
    state: "running" | "suspended" = initialState;
    currentTime = 0;
    destination = {};
    createOscillator(): FakeOscillator {
      const oscillator: FakeOscillator = {
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
    resume() {
      if (this.state === "running") return Promise.resolve();
      return new Promise<void>((resolve) => {
        unlock.release = () => {
          this.state = "running";
          resolve();
        };
      });
    }
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T22:00:00Z"));
  localStorage.clear();
  oscillators = [];
  unlock.release = () => undefined;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("F07 mobile notification audio timing", () => {
  it("starts the incoming ringtone in the same task when audio is already unlocked", async () => {
    vi.stubGlobal("AudioContext", mockAudioContext("running"));
    const audio = await import("./notification-sound");
    await audio.unlockNotificationAudio();
    const primed = oscillators.length;
    expect(audio.isNotificationAudioReady()).toBe(true);

    audio.startLoop("ride-1", Date.now() + 15_000);
    // Two simultaneous oscillator waveforms per each of the two notes.
    expect(oscillators.length).toBe(primed + 4);
    audio.stopLoop("ride-1");
    expect(oscillators.slice(primed).every((o) => o.stop.mock.calls.length >= 1)).toBe(true);

    vi.advanceTimersByTime(18_000);
    expect(oscillators.length).toBe(primed + 4);
  });

  it("never plays a stale ringtone when Safari unlocks only on a subsequent tap", async () => {
    vi.stubGlobal("AudioContext", mockAudioContext("suspended"));
    const audio = await import("./notification-sound");
    const pendingUnlock = audio.unlockNotificationAudio();
    expect(audio.isNotificationAudioReady()).toBe(false);
    const primed = oscillators.length;

    audio.startLoop("ride-2", Date.now() + 15_000);
    expect(oscillators.length).toBe(primed);
    audio.stopLoop("ride-2");
    unlock.release();
    await pendingUnlock;
    expect(oscillators.length).toBe(primed);

    vi.advanceTimersByTime(60_000);
    expect(oscillators.length).toBe(primed);
  });

  it("does not play after deadline or after repeated stop calls", async () => {
    vi.stubGlobal("AudioContext", mockAudioContext("running"));
    const audio = await import("./notification-sound");
    await audio.unlockNotificationAudio();
    const primed = oscillators.length;
    audio.startLoop("expired", Date.now() - 100);
    expect(oscillators.length).toBe(primed);

    audio.startLoop("ride-3", Date.now() + 15_000);
    vi.advanceTimersByTime(15_100);
    const atDeadline = oscillators.length;
    audio.stopLoop("ride-3");
    vi.advanceTimersByTime(60_000);
    expect(oscillators.length).toBe(atDeadline);
  });
});
