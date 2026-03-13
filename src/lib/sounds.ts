// Simple sound effects using Web Audio API - no external files needed
let audioCtx: AudioContext | null = null;
let _muted = localStorage.getItem('bingo-muted') === 'true';

export function isMuted() { return _muted; }
export function setMuted(val: boolean) {
  _muted = val;
  localStorage.setItem('bingo-muted', String(val));
}
function getAudioCtx() {
  if (!audioCtx && typeof window !== 'undefined') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  if (_muted) return;
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

// Amharic number names 1-75
const AMHARIC_NUMBERS: Record<number, string> = {
  1: 'አንድ', 2: 'ሁለት', 3: 'ሦስት', 4: 'አራት', 5: 'አምስት',
  6: 'ስድስት', 7: 'ሰባት', 8: 'ስምንት', 9: 'ዘጠኝ', 10: 'አስር',
  11: 'አስራ አንድ', 12: 'አስራ ሁለት', 13: 'አስራ ሦስት', 14: 'አስራ አራት', 15: 'አስራ አምስት',
  16: 'አስራ ስድስት', 17: 'አስራ ሰባት', 18: 'አስራ ስምንት', 19: 'አስራ ዘጠኝ', 20: 'ሀያ',
  21: 'ሀያ አንድ', 22: 'ሀያ ሁለት', 23: 'ሀያ ሦስት', 24: 'ሀያ አራት', 25: 'ሀያ አምስት',
  26: 'ሀያ ስድስት', 27: 'ሀያ ሰባት', 28: 'ሀያ ስምንት', 29: 'ሀያ ዘጠኝ', 30: 'ሰላሳ',
  31: 'ሰላሳ አንድ', 32: 'ሰላሳ ሁለት', 33: 'ሰላሳ ሦስት', 34: 'ሰላሳ አራት', 35: 'ሰላሳ አምስት',
  36: 'ሰላሳ ስድስት', 37: 'ሰላሳ ሰባት', 38: 'ሰላሳ ስምንት', 39: 'ሰላሳ ዘጠኝ', 40: 'አርባ',
  41: 'አርባ አንድ', 42: 'አርባ ሁለት', 43: 'አርባ ሦስት', 44: 'አርባ አራት', 45: 'አርባ አምስት',
  46: 'አርባ ስድስት', 47: 'አርባ ሰባት', 48: 'አርባ ስምንት', 49: 'አርባ ዘጠኝ', 50: 'ሀምሳ',
  51: 'ሀምሳ አንድ', 52: 'ሀምሳ ሁለት', 53: 'ሀምሳ ሦስት', 54: 'ሀምሳ አራት', 55: 'ሀምሳ አምስት',
  56: 'ሀምሳ ስድስት', 57: 'ሀምሳ ሰባት', 58: 'ሀምሳ ስምንት', 59: 'ሀምሳ ዘጠኝ', 60: 'ስልሳ',
  61: 'ስልሳ አንድ', 62: 'ስልሳ ሁለት', 63: 'ስልሳ ሦስት', 64: 'ስልሳ አራት', 65: 'ስልሳ አምስት',
  66: 'ስልሳ ስድስት', 67: 'ስልሳ ሰባት', 68: 'ስልሳ ስምንት', 69: 'ስልሳ ዘጠኝ', 70: 'ሰባ',
  71: 'ሰባ አንድ', 72: 'ሰባ ሁለት', 73: 'ሰባ ሦስት', 74: 'ሰባ አራት', 75: 'ሰባ አምስት',
};

const AMHARIC_LETTERS: Record<string, string> = {
  'B': 'ቢ', 'I': 'አይ', 'N': 'ኤን', 'G': 'ጂ', 'O': 'ኦ'
};

/** Announce a bingo number vocally in Amharic using Web Speech API */
export function announceNumber(num: number) {
  if (_muted) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const letter =
    num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';

  const amharicLetter = AMHARIC_LETTERS[letter] || letter;
  const amharicNumber = AMHARIC_NUMBERS[num] || String(num);

  const utterance = new SpeechSynthesisUtterance(`${amharicLetter} ${amharicNumber}`);
  utterance.rate = 0.85;
  utterance.pitch = 1.0;
  utterance.volume = 1;
  utterance.lang = 'am-ET';

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
