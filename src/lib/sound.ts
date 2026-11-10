/**
 * Procedural Web Audio synthesizer for Focus Mode ambient sounds (rain, white noise, zen harmonics)
 * and completion chime. Zero external audio dependencies.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private gainNode: GainNode | null = null;

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
        // Pink/brownish filter for warm rain feel
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
}

export const soundEngine = new SoundEngine();
