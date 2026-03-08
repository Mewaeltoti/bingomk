// Simple sound effects using Web Audio API - no external files needed
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export function playDrawSound() {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  playTone(880, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(1100, 0.12, 'sine', 0.15), 80);
}

export function playWinSound() {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.25), i * 150);
  });
}

export function playMarkSound() {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  playTone(600, 0.08, 'sine', 0.1);
}
