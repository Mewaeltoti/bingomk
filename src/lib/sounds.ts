// Simple sound effects using Web Audio API - no external files needed
let audioCtx: AudioContext | null = null;

function getAudioCtx() {
  if (!audioCtx && typeof window !== 'undefined') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playDrawSound() {
  playTone(880, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(1100, 0.12, 'sine', 0.15), 80);
}

export function playWinSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.25), i * 150);
  });
}

export function playMarkSound() {
  playTone(600, 0.08, 'sine', 0.1);
}

/** Announce a bingo number vocally using Web Speech API */
export function announceNumber(num: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const letter =
    num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';

  const utterance = new SpeechSynthesisUtterance(`${letter} ${num}`);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;
  utterance.lang = 'en-US';

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
