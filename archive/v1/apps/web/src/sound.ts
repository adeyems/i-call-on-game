let sharedAudioContext: AudioContext | null = null;
let timerLoopAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }

  return sharedAudioContext;
}

function playOscillatorSequence(frequencies: number[], noteLengthSeconds = 0.12): void {
  try {
    const context = getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }

    frequencies.forEach((frequency, index) => {
      const startAt = context.currentTime + index * noteLengthSeconds;
      const stopAt = startAt + noteLengthSeconds;

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, startAt);

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(0.15, startAt + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(startAt);
      oscillator.stop(stopAt);
    });
  } catch {
    // Sound should never break gameplay flow.
  }
}

function playClipSnippet(src: string, durationMs: number, volume = 0.2): void {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.currentTime = 0;
    void audio.play();

    window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, durationMs);
  } catch {
    // Ignore playback failures due to autoplay policies.
  }
}

export function playNotificationSound(): void {
  playOscillatorSequence([880]);
}

export function playTurnStartSound(): void {
  playOscillatorSequence([523, 659, 784], 0.09);
}

export function startRoundTimerSong(): void {
  try {
    if (!timerLoopAudio) {
      timerLoopAudio = new Audio("/audio/round-theme.ogg");
      timerLoopAudio.loop = true;
      timerLoopAudio.volume = 0.16;
    }

    if (!timerLoopAudio.paused) {
      return;
    }

    timerLoopAudio.currentTime = 0;
    void timerLoopAudio.play();
  } catch {
    // Ignore playback failures due to autoplay policies.
  }
}

export function stopRoundTimerSong(): void {
  try {
    if (!timerLoopAudio) {
      return;
    }

    timerLoopAudio.pause();
    timerLoopAudio.currentTime = 0;
  } catch {
    // Ignore playback failures due to autoplay policies.
  }
}

export function playSubmissionSound(): void {
  playOscillatorSequence([740, 988], 0.07);
}

export function playRoundEndSound(): void {
  playOscillatorSequence([784, 659, 523], 0.1);
  playClipSnippet("/audio/lobby-theme.ogg", 1200, 0.16);
}
