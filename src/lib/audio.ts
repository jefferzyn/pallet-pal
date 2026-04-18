/**
 * Audio utilities for the scanning app
 * Provides sound effects for barcode scanning
 */

/**
 * Play a successful scan sound effect
 * Uses Web Audio API to generate a beep tone
 */
export async function playScanSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Create oscillator for beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure beep: high frequency, short duration
    oscillator.frequency.value = 900; // Hz (high pitch)
    oscillator.type = "sine";

    // Fade in and out
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);

    return true;
  } catch (error) {
    console.warn("Failed to play scan sound", error);
    return false;
  }
}

/**
 * Play error sound effect
 */
export async function playErrorSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Lower frequency for error
    oscillator.frequency.value = 400; // Hz (lower pitch)
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);

    return true;
  } catch (error) {
    console.warn("Failed to play error sound", error);
    return false;
  }
}
