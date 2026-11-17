// LENTERA LAUT — synthetic WebAudio sounds, no audio assets. The context is created
// on the first user gesture (browsers block audio before one), and every call is a
// no-op until then, so the game never crashes on a silent page.

export function createAudio() {
  let ctx = null;
  let master = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, endFreq, dur, type, gain) {
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // A sound that fails is not worth crashing the game over.
    }
  }

  function noise(dur, gain) {
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
    } catch {
      // Ignore.
    }
  }

  return {
    unlock,
    collect() { tone(660, 990, 0.12, 'sine', 0.5); },
    bank() {
      tone(523, 523, 0.1, 'sine', 0.4);
      setTimeout(() => tone(659, 659, 0.1, 'sine', 0.4), 70);
      setTimeout(() => tone(784, 784, 0.16, 'sine', 0.45), 140);
    },
    hit() { tone(140, 55, 0.28, 'sawtooth', 0.6); noise(0.2, 0.3); },
    buy() { tone(880, 880, 0.08, 'sine', 0.45); setTimeout(() => tone(1174, 1174, 0.12, 'sine', 0.45), 80); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.22, 'sine', 0.5), i * 110));
    },
    click() { tone(440, 440, 0.06, 'sine', 0.3); },
  };
}
