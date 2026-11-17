// Sound effects, synthesized live with the Web Audio API — no audio files, no
// network. The context is created on the first user gesture (browsers block
// sound before one); until then every call is a silent no-op.

const NOTES = { shoot: 880, hit: 220, boom: 90, shard: 1320, power: 660, wave: 523, over: 174 };

export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, duration, type, slideTo) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    /** Call from a user gesture so the browser allows sound afterwards. */
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
    shoot() { tone(NOTES.shoot, 0.07, 'square', 440); },
    hit() { tone(NOTES.hit, 0.18, 'sawtooth', 70); },
    boom() { tone(NOTES.boom, 0.4, 'sawtooth', 40); },
    shard() { tone(NOTES.shard, 0.09, 'sine', 1760); },
    power() { tone(NOTES.power, 0.16, 'triangle', 990); },
    wave() { tone(NOTES.wave, 0.22, 'triangle', 784); },
    over() { tone(NOTES.over, 0.7, 'sawtooth', 55); },
  };
}
