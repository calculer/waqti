import type { AlarmTone } from '../types';

/**
 * Procedural Web Audio synthesizer for Focus Mode ambient sounds (rain, white noise, zen harmonics),
 * completion chime, and the 5 luxury alarm tones (soft_bell, morning_chime, marimba, gentle_rise, digital)
 * with gradual volume ramp. Zero external audio dependencies.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private gainNode: GainNode | null = null;
  private alarmIntervalId: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public stopAmbient(): void {
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.activeNodes = [];
    this.gainNode = null;
  }

  public startAmbient(mode: 'none' | 'rain' | 'whitenoise' | 'tones'): void {
    this.stopAmbient();
    if (mode === 'none') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.08;
    masterGain.connect(ctx.destination);
    this.gainNode = masterGain;

    if (mode === 'whitenoise' || mode === 'rain') {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= mode === 'rain' ? 2.5 : 1.5;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = mode === 'rain' ? 'bandpass' : 'lowpass';
      filter.frequency.value = mode === 'rain' ? 950 : 600;

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();
      this.activeNodes.push(whiteNoise, filter, masterGain);
    } else if (mode === 'tones') {
      const freqs = [220, 277.18, 329.63]; // A3 major triad
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        oscGain.gain.value = 0.25;
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start();
        this.activeNodes.push(osc, oscGain);
      }
      this.activeNodes.push(masterGain);
    }
  }

  public playCompletionChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.15, now + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.75);
    });
  }

  /**
   * Plays a single motif of one of the 5 procedural Web Audio alarm tones.
   */
  public playAlarmPreview(tone: AlarmTone = 'soft_bell', volume: number = 0.75): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const safeVol = Math.max(0.05, Math.min(1, volume)) * 0.25;

    const playNote = (
      freq: number,
      offsetSec: number,
      durSec: number,
      wave: OscillatorType = 'sine',
      peakGain: number = safeVol
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + offsetSec);
      gain.gain.setValueAtTime(0.0001, now + offsetSec);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + offsetSec + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offsetSec + durSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offsetSec);
      osc.stop(now + offsetSec + durSec + 0.05);
    };

    if (tone === 'soft_bell') {
      // Warm harmonic bell fifths (D5, A5, F#5)
      playNote(587.33, 0, 0.9, 'sine', safeVol);
      playNote(880.0, 0.22, 0.9, 'triangle', safeVol * 0.85);
      playNote(739.99, 0.45, 1.1, 'sine', safeVol);
    } else if (tone === 'morning_chime') {
      // Uplifting arpeggio (G4, B4, D5, G5)
      const notes = [392.0, 493.88, 587.33, 783.99];
      notes.forEach((f, i) => playNote(f, i * 0.16, 0.75, 'triangle', safeVol));
    } else if (tone === 'marimba') {
      // Percussive wooden marimba chords
      const notes = [523.25, 659.25, 783.99, 659.25, 1046.5];
      notes.forEach((f, i) => playNote(f, i * 0.13, 0.28, 'sine', safeVol * 1.1));
    } else if (tone === 'gentle_rise') {
      // Slow, soothing swell chord
      const notes = [440.0, 554.37, 659.25, 880.0];
      notes.forEach((f, i) => playNote(f, i * 0.25, 1.1, 'sine', safeVol * 0.8));
    } else {
      // Crisp digital studio pulse
      playNote(987.77, 0, 0.14, 'square', safeVol * 0.5);
      playNote(987.77, 0.18, 0.14, 'square', safeVol * 0.5);
      playNote(1318.51, 0.4, 0.28, 'square', safeVol * 0.5);
    }
  }

  /**
   * Starts a looping alarm ring with gradual volume ramp and optional vibration.
   */
  public startAlarmRinging(
    tone: AlarmTone = 'soft_bell',
    targetVolume: number = 0.8,
    vibrate: boolean = true
  ): void {
    this.stopAlarmRinging();
    let step = 0;

    const canVibrate = () => {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return false;
      }
      const ua = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
        .userActivation;
      return ua ? Boolean(ua.hasBeenActive) : true;
    };

    const triggerPulse = () => {
      step += 1;
      // Gradual volume ramp over first 4 cycles
      const rampFactor = Math.min(1, 0.35 + step * 0.2);
      this.playAlarmPreview(tone, targetVolume * rampFactor);
      if (vibrate && canVibrate()) {
        try {
          navigator.vibrate([250, 120, 250]);
        } catch {
          // Ignore vibration restrictions
        }
      }
    };

    triggerPulse();
    if (typeof window !== 'undefined') {
      this.alarmIntervalId = window.setInterval(triggerPulse, 2400);
    }
  }

  public stopAlarmRinging(): void {
    const wasRinging = this.alarmIntervalId !== null;
    if (this.alarmIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }
    if (wasRinging && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const ua = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
        .userActivation;
      if (!ua || ua.hasBeenActive) {
        try {
          navigator.vibrate(0);
        } catch {
          // Ignore
        }
      }
    }
  }
}

export const soundEngine = new SoundEngine();
