import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockAudio {
  static instances: MockAudio[] = [];

  src: string;
  volume = 1;
  currentTime = 0;
  loop = false;
  paused = true;

  play = vi.fn(async () => {
    this.paused = false;
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(src = "") {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

type MockContext = {
  state: "running" | "suspended";
  currentTime: number;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
};

function installAudioContextMock(state: "running" | "suspended" = "running"): MockContext {
  const context: MockContext = {
    state,
    currentTime: 0,
    resume: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => ({
      type: "triangle",
      frequency: {
        setValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    })),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    }))
  };

  const MockCtor = vi.fn(() => context);
  Object.defineProperty(window, "AudioContext", {
    value: MockCtor,
    configurable: true
  });

  return context;
}

describe("unit: sound helpers", () => {
  const originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext;
  const originalAudio = globalThis.Audio;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    MockAudio.instances = [];

    Object.defineProperty(globalThis, "Audio", {
      value: MockAudio,
      configurable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "AudioContext", {
      value: originalAudioContext,
      configurable: true
    });
    Object.defineProperty(globalThis, "Audio", {
      value: originalAudio,
      configurable: true
    });
  });

  it("does not throw when AudioContext is unavailable", async () => {
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      configurable: true
    });

    const sound = await import("../sound");
    expect(() => sound.playNotificationSound()).not.toThrow();
    expect(() => sound.playSubmissionSound()).not.toThrow();
  });

  it("plays oscillator sequence and resumes suspended context", async () => {
    const context = installAudioContextMock("suspended");
    const sound = await import("../sound");

    sound.playTurnStartSound();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(context.createGain).toHaveBeenCalledTimes(3);
  });

  it("starts and stops looping timer song", async () => {
    installAudioContextMock("running");
    const sound = await import("../sound");

    sound.startRoundTimerSong();
    sound.startRoundTimerSong();

    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0].src).toBe("/audio/round-theme.ogg");
    expect(MockAudio.instances[0].loop).toBe(true);
    expect(MockAudio.instances[0].play).toHaveBeenCalledTimes(1);

    sound.stopRoundTimerSong();
    expect(MockAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    expect(MockAudio.instances[0].currentTime).toBe(0);
  });

  it("plays round end sequence and stops clip snippet after timeout", async () => {
    installAudioContextMock("running");
    const sound = await import("../sound");

    sound.playRoundEndSound();

    const snippet = MockAudio.instances.find((instance) => instance.src === "/audio/lobby-theme.ogg");
    expect(snippet).toBeDefined();
    expect(snippet?.play).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1200);
    expect(snippet?.pause).toHaveBeenCalledTimes(1);
    expect(snippet?.currentTime).toBe(0);
  });
});
