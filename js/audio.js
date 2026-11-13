(function (global) {
  'use strict';

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  class ChiptuneAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.volume = 0.65;
      this.currentTrack = null;
      this.step = 0;
      this.timer = 0;
      this.speedMult = 1.0;
      this.noiseBuf = null;
      this.lastSfxTime = {};
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume * 0.45;
        this.master.connect(this.ctx.destination);
        // White noise buffer for percussion & explosions
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
      }
    }

    setMuted(m) {
      this.muted = !!m;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.45, this.ctx.currentTime, 0.02);
      }
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master && this.ctx && !this.muted) {
        this.master.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.02);
      }
    }

    canPlaySfx(key, cooldown = 0.03) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return false;
      const now = this.ctx.currentTime;
      if (this.lastSfxTime[key] && now - this.lastSfxTime[key] < cooldown) return false;
      this.lastSfxTime[key] = now;
      return true;
    }

    tone(freq, dur, type = 'square', gainVal = 0.22, delay = 0, endFreq = null) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, freq), t0);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + dur);
      }
      gain.gain.setValueAtTime(gainVal, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    }

    noise(dur, gainVal = 0.18, highpass = 800, delay = 0) {
      if (!this.ctx || !this.noiseBuf || this.muted || this.ctx.state !== 'running') return;
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(highpass, t0);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.01);
    }

    // ---- SFX ----
    jump(big) {
      if (!this.canPlaySfx('jump', 0.05)) return;
      const f0 = big ? 190 : 250;
      const f1 = big ? 480 : 620;
      this.tone(f0, 0.14, 'square', 0.2, 0, f1);
    }

    coin() {
      if (!this.canPlaySfx('coin', 0.03)) return;
      this.tone(987.77, 0.06, 'square', 0.2, 0);
      this.tone(1318.51, 0.22, 'square', 0.2, 0.055);
    }

    starCoin() {
      if (!this.canPlaySfx('starcoin', 0.05)) return;
      [659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => {
        this.tone(f, 0.14, 'square', 0.22, i * 0.055);
      });
    }

    powerupAppear() {
      if (!this.canPlaySfx('papp', 0.05)) return;
      [330, 440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.07, 'triangle', 0.22, i * 0.04));
    }

    powerup() {
      if (!this.canPlaySfx('power', 0.08)) return;
      const notes = [523, 659, 784, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((f, i) => this.tone(f, 0.08, 'square', 0.2, i * 0.045));
    }

    oneUp() {
      if (!this.canPlaySfx('oneup', 0.1)) return;
      const notes = [330, 392, 659, 523, 587, 784];
      notes.forEach((f, i) => this.tone(f, 0.1, 'square', 0.24, i * 0.065));
    }

    stomp(combo = 0) {
      if (!this.canPlaySfx('stomp', 0.03)) return;
      const pitch = Math.min(2.0, 1 + combo * 0.12);
      this.tone(360 * pitch, 0.09, 'square', 0.24, 0, 140 * pitch);
      this.noise(0.06, 0.16, 1200);
    }

    kick() {
      if (!this.canPlaySfx('kick', 0.04)) return;
      this.tone(240, 0.09, 'triangle', 0.28, 0, 520);
      this.noise(0.05, 0.18, 1600);
    }

    fireball() {
      if (!this.canPlaySfx('fire', 0.06)) return;
      this.tone(680, 0.08, 'square', 0.16, 0, 220);
    }

    tailSpin() {
      if (!this.canPlaySfx('tail', 0.08)) return;
      this.tone(280, 0.07, 'triangle', 0.22, 0, 580);
      this.noise(0.08, 0.15, 2200, 0.02);
    }

    groundPound() {
      if (!this.canPlaySfx('gp', 0.08)) return;
      this.tone(180, 0.14, 'sawtooth', 0.25, 0, 55);
      this.noise(0.14, 0.25, 380);
    }

    brickBump() {
      if (!this.canPlaySfx('bump', 0.04)) return;
      this.tone(160, 0.08, 'triangle', 0.25, 0, 95);
    }

    brickBreak() {
      if (!this.canPlaySfx('break', 0.04)) return;
      this.tone(210, 0.09, 'square', 0.2, 0, 70);
      this.noise(0.14, 0.26, 950);
    }

    pipe() {
      if (!this.canPlaySfx('pipe', 0.15)) return;
      for (let i = 0; i < 3; i++) {
        this.tone(420, 0.09, 'square', 0.18, i * 0.11, 140);
      }
    }

    spring() {
      if (!this.canPlaySfx('spring', 0.08)) return;
      this.tone(220, 0.18, 'square', 0.22, 0, 880);
    }

    switchToggle() {
      if (!this.canPlaySfx('sw', 0.05)) return;
      this.tone(520, 0.06, 'square', 0.2, 0);
      this.tone(780, 0.09, 'square', 0.2, 0.05);
    }

    bowserFire() {
      if (!this.canPlaySfx('bfire', 0.12)) return;
      this.tone(140, 0.25, 'sawtooth', 0.22, 0, 65);
      this.noise(0.28, 0.24, 520);
    }

    hurt() {
      if (!this.canPlaySfx('hurt', 0.12)) return;
      this.tone(480, 0.12, 'sawtooth', 0.24, 0, 140);
      this.tone(360, 0.18, 'square', 0.2, 0.1, 110);
    }

    flagpole() {
      if (!this.canPlaySfx('flag', 0.3)) return;
      [523, 587, 659, 784, 880, 1046].forEach((f, i) => this.tone(f, 0.11, 'square', 0.2, i * 0.07));
    }

    firework() {
      if (!this.canPlaySfx('fw', 0.08)) return;
      this.tone(700, 0.08, 'square', 0.14, 0, 1200);
      this.noise(0.18, 0.2, 1800, 0.06);
    }

    pause() {
      if (!this.canPlaySfx('pause', 0.1)) return;
      this.tone(659, 0.07, 'square', 0.2, 0);
      this.tone(523, 0.07, 'square', 0.2, 0.07);
      this.tone(659, 0.07, 'square', 0.2, 0.14);
      this.tone(784, 0.11, 'square', 0.2, 0.21);
    }

    // ---- BGM SEQUENCER ----
    playTrack(name, speedMult = 1.0) {
      this.speedMult = speedMult;
      if (this.currentTrack === name) return;
      this.currentTrack = name;
      this.step = 0;
      this.timer = 0;
    }

    playFanfare(kind) {
      this.currentTrack = null;
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      if (kind === 'clear') {
        const seq = [
          [523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.24],
          [784, 0.12], [1046, 0.45],
        ];
        let t = 0;
        for (const [f, d] of seq) {
          this.tone(f, d * 0.9, 'square', 0.22, t);
          this.tone(f * 0.5, d * 0.9, 'triangle', 0.24, t);
          t += d;
        }
      } else if (kind === 'gameover') {
        const seq = [
          [523, 0.18], [493, 0.18], [466, 0.18], [440, 0.28],
          [392, 0.2], [349, 0.2], [330, 0.55],
        ];
        let t = 0;
        for (const [f, d] of seq) {
          this.tone(f, d * 0.9, 'triangle', 0.26, t);
          t += d;
        }
      } else if (kind === 'victory') {
        const seq = [
          [523, 0.14], [587, 0.14], [659, 0.14], [784, 0.2],
          [659, 0.14], [784, 0.14], [880, 0.2], [1046, 0.48],
        ];
        let t = 0;
        for (const [f, d] of seq) {
          this.tone(f, d * 0.92, 'square', 0.22, t);
          this.tone(f * 0.5, d * 0.92, 'triangle', 0.24, t);
          t += d;
        }
      }
    }

    update(dt) {
      if (!this.currentTrack || !this.ctx || this.muted || this.ctx.state !== 'running') return;
      const track = TRACKS[this.currentTrack];
      if (!track) return;
      const stepDur = track.stepDur / this.speedMult;
      this.timer += dt;
      if (this.timer >= stepDur) {
        this.timer -= stepDur;
        const idx = this.step % track.lead.length;
        const leadNote = track.lead[idx];
        const bassNote = track.bass[idx];
        const hat = track.drums ? track.drums[idx] : 0;
        if (leadNote > 0) this.tone(midiToFreq(leadNote), stepDur * 0.86, track.leadWave || 'square', 0.11);
        if (bassNote > 0) this.tone(midiToFreq(bassNote), stepDur * 0.9, 'triangle', 0.16);
        if (hat === 1) this.noise(0.03, 0.06, 4200);
        else if (hat === 2) this.noise(0.07, 0.11, 1400);
        this.step++;
      }
    }
  }

  // Cheerful original retro chiptune patterns (MIDI note numbers, 0 = rest)
  const TRACKS = {
    map: {
      stepDur: 0.16,
      leadWave: 'square',
      lead: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 81, 0, 79, 0, 0, 0, 74, 0, 77, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0],
      bass: [48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 60, 0, 55, 0, 55, 0, 50, 0, 55, 0, 53, 0, 55, 0, 48, 0, 55, 0, 48, 0, 0, 0],
      drums: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0],
    },
    meadow: {
      stepDur: 0.135,
      leadWave: 'square',
      lead: [
        76, 76, 0, 76, 0, 72, 76, 0, 79, 0, 0, 0, 67, 0, 0, 0,
        72, 0, 0, 67, 0, 0, 64, 0, 0, 69, 0, 71, 0, 70, 69, 0,
        67, 76, 79, 81, 0, 77, 79, 0, 76, 0, 72, 74, 71, 0, 0, 0,
        72, 0, 0, 67, 0, 0, 64, 0, 0, 69, 0, 71, 0, 70, 69, 0,
      ],
      bass: [
        48, 0, 55, 0, 48, 0, 55, 0, 43, 0, 55, 0, 43, 0, 47, 0,
        48, 0, 55, 0, 43, 0, 52, 0, 45, 0, 52, 0, 47, 0, 53, 0,
        48, 0, 52, 0, 53, 0, 57, 0, 48, 0, 55, 0, 43, 0, 47, 0,
        48, 0, 55, 0, 43, 0, 52, 0, 45, 0, 53, 0, 55, 0, 48, 0,
      ],
      drums: [
        1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1,
        1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0,
        1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1,
        1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 2, 2,
      ],
    },
    cavern: {
      stepDur: 0.145,
      leadWave: 'triangle',
      lead: [
        60, 72, 57, 69, 58, 70, 0, 0, 60, 72, 57, 69, 58, 70, 0, 0,
        53, 65, 50, 62, 51, 63, 0, 0, 53, 65, 50, 62, 51, 63, 0, 0,
        63, 62, 61, 60, 63, 62, 56, 55, 54, 60, 59, 65, 64, 63, 62, 0,
      ],
      bass: [
        36, 48, 33, 45, 34, 46, 0, 0, 36, 48, 33, 45, 34, 46, 0, 0,
        29, 41, 26, 38, 27, 39, 0, 0, 29, 41, 26, 38, 27, 39, 0, 0,
        39, 0, 38, 0, 36, 0, 31, 0, 36, 0, 35, 0, 41, 0, 36, 0,
      ],
      drums: [
        1, 0, 1, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0,
        1, 0, 1, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0,
        1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 2, 2, 0,
      ],
    },
    sky: {
      stepDur: 0.13,
      leadWave: 'square',
      lead: [
        79, 0, 83, 86, 0, 83, 79, 0, 81, 0, 84, 88, 0, 84, 81, 0,
        78, 0, 81, 86, 0, 81, 78, 0, 79, 0, 83, 86, 88, 0, 86, 0,
        88, 0, 86, 84, 0, 83, 81, 0, 79, 81, 83, 84, 86, 0, 83, 0,
        81, 0, 79, 78, 0, 76, 74, 0, 79, 0, 83, 86, 91, 0, 0, 0,
      ],
      bass: [
        55, 0, 59, 0, 62, 0, 59, 0, 57, 0, 60, 0, 64, 0, 60, 0,
        54, 0, 57, 0, 62, 0, 57, 0, 55, 0, 59, 0, 62, 0, 59, 0,
        60, 0, 64, 0, 55, 0, 59, 0, 57, 0, 60, 0, 62, 0, 59, 0,
        57, 0, 54, 0, 50, 0, 54, 0, 55, 0, 59, 0, 55, 0, 0, 0,
      ],
      drums: [
        1, 0, 1, 2, 0, 1, 1, 0, 1, 0, 1, 2, 0, 1, 1, 0,
        1, 0, 1, 2, 0, 1, 1, 0, 1, 0, 1, 2, 0, 1, 2, 0,
        1, 0, 1, 2, 0, 1, 1, 0, 1, 0, 1, 2, 0, 1, 1, 0,
        1, 0, 1, 2, 0, 1, 2, 0, 1, 0, 1, 2, 2, 0, 0, 0,
      ],
    },
    castle: {
      stepDur: 0.125,
      leadWave: 'sawtooth',
      lead: [
        64, 67, 71, 67, 64, 67, 71, 67, 65, 69, 72, 69, 65, 69, 72, 69,
        63, 66, 71, 66, 63, 66, 71, 66, 64, 67, 71, 76, 75, 74, 71, 67,
        76, 0, 75, 76, 0, 72, 71, 69, 67, 0, 66, 67, 0, 64, 63, 0,
        64, 67, 71, 76, 79, 76, 71, 67, 66, 71, 75, 78, 76, 0, 0, 0,
      ],
      bass: [
        40, 40, 47, 40, 40, 40, 47, 40, 41, 41, 48, 41, 41, 41, 48, 41,
        39, 39, 47, 39, 39, 39, 47, 39, 40, 40, 47, 40, 40, 43, 47, 40,
        40, 40, 47, 40, 45, 45, 48, 45, 43, 43, 47, 43, 39, 39, 47, 39,
        40, 40, 47, 40, 40, 43, 47, 40, 39, 39, 47, 39, 40, 0, 0, 0,
      ],
      drums: [
        2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1,
        2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1,
        2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1,
        2, 1, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 0, 0, 0,
      ],
    },
    star: {
      stepDur: 0.095,
      leadWave: 'square',
      lead: [
        84, 84, 84, 0, 84, 0, 84, 84, 81, 81, 81, 0, 81, 0, 81, 81,
        83, 83, 83, 0, 83, 0, 83, 83, 79, 79, 81, 83, 84, 0, 88, 0,
      ],
      bass: [
        48, 60, 48, 60, 48, 60, 48, 60, 45, 57, 45, 57, 45, 57, 45, 57,
        47, 59, 47, 59, 47, 59, 47, 59, 43, 55, 45, 57, 48, 60, 48, 60,
      ],
      drums: [
        2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1,
        2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2,
      ],
    },
  };

  global.MarioGame = global.MarioGame || {};
  global.MarioGame.ChiptuneAudio = ChiptuneAudio;
})(window);
