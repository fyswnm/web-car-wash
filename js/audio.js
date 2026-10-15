/**
 * Procedural Audio Engine for Car Wash Game
 * 使用 Web Audio API 动态合成洗车音效，无需下载外部音频资源，零延迟且兼容 iOS/iPad/Chrome
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.activeNodes = {
      water: null,
      foam: null,
      cloth: null
    };
    this.noiseBuffers = {};
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
      this.generateNoiseBuffers();
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopToolAudio();
    }
    return this.isMuted;
  }

  generateNoiseBuffers() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    
    // 白噪声
    const whiteBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const whiteData = whiteBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffers.white = whiteBuffer;

    // 粉红噪声 (适合水流模拟)
    const pinkBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const pinkData = pinkBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.noiseBuffers.pink = pinkBuffer;
  }

  /**
   * 播放工具持续音效 (水枪、泡沫、布擦)
   */
  startToolAudio(toolType) {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    // 如果已经在播放相同工具音效，保持
    if (this.activeNodes[toolType]) return;

    // 停止其他正在播放的工具音效
    this.stopToolAudio();

    const t = this.ctx.currentTime;

    if (toolType === 'water') {
      // 高压水枪：粉红噪声 + 带通滤波 + 湍流调制
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffers.pink || this.noiseBuffers.white;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(180, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.08);

      source.connect(highpass);
      highpass.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();
      this.activeNodes.water = { source, gain };

    } else if (toolType === 'foam') {
      // 泡沫喷射：白噪声 + 高通嘶嘶声 + 气泡微共鸣
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffers.white;
      source.loop = true;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2800, t);
      bandpass.Q.setValueAtTime(1.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.1);

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();
      this.activeNodes.foam = { source, gain };

    } else if (toolType === 'cloth') {
      // 抹布擦拭：低频摩擦 + 偶尔高频擦亮吱吱声
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffers.pink || this.noiseBuffers.white;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(700, t);
      filter.Q.setValueAtTime(3.0, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.05);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();
      this.activeNodes.cloth = { source, gain };

      // 偶尔触发擦镜面的“吱吱”音
      if (Math.random() < 0.35) {
        this.playSqueak();
      }
    }
  }

  stopToolAudio() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    ['water', 'foam', 'cloth'].forEach(type => {
      const active = this.activeNodes[type];
      if (active) {
        try {
          active.gain.gain.cancelScheduledValues(t);
          active.gain.gain.linearRampToValueAtTime(0.001, t + 0.08);
          setTimeout(() => {
            try { active.source.stop(); } catch (e) {}
          }, 90);
        } catch (e) {}
        this.activeNodes[type] = null;
      }
    });
  }

  playSqueak() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(2600, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.12);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playSparkle() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const freqs = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startT = t + idx * 0.04;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.06, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startT);
      osc.stop(startT + 0.26);
    });
  }

  playClick() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playWinFanfare() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    // 喜庆胜利和弦五重奏: C5 - E5 - G5 - C6 - E6
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.1;
      const duration = 0.55;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  playTimeout() {
    if (this.isMuted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const notes = [440, 392, 349.23, 293.66]; // A4 -> G4 -> F4 -> D4
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.16;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.26);
    });
  }

  playTick() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }
}

window.soundEngine = new SoundEngine();
