// Global audio manager - ensures only one response speaks at a time

type StopCallback = () => void;

let currentAudio: HTMLAudioElement | null = null;
let currentStopCallback: StopCallback | null = null;

export const audioManager = {
  /**
   * Play audio, stopping any currently playing audio first.
   * Returns the audio element for the caller to track.
   */
  play(audio: HTMLAudioElement, onStop: StopCallback): void {
    // Stop any currently playing audio
    this.stopCurrent();

    currentAudio = audio;
    currentStopCallback = onStop;

    audio.play();
  },

  /**
   * Stop the currently playing audio and notify its owner.
   */
  stopCurrent(): void {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (currentStopCallback) {
      currentStopCallback();
      currentStopCallback = null;
    }
  },

  /**
   * Check if a specific audio element is the one currently playing.
   */
  isCurrentAudio(audio: HTMLAudioElement): boolean {
    return currentAudio === audio;
  },

  /**
   * Clear the current audio reference (called when audio ends naturally).
   */
  clear(): void {
    currentAudio = null;
    currentStopCallback = null;
  },
};
