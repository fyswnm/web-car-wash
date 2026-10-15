/**
 * High-Performance Mobile-Optimized Particle System for Car Wash Game
 * 性能优化重点：
 * 1. 使用离线缓冲 Sprite 贴图，避免每帧执行昂贵的 createRadialGradient 和频繁状态保存
 * 2. 严格限制最大粒子上限 (Max 50)，防止移动端/手机喷射过多清洗剂卡顿
 * 3. 路径批处理绘制，极大减少 Canvas Draw Call，保证 60 FPS 流畅运行
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.sparkles = [];
    this.floatingTexts = [];
    this.maxParticles = 50; // 移动端严格限制，杜绝卡顿
    this.lastEmitTime = 0;

    // 创建离线泡沫贴图 (仅在初始化时创建一次，硬件加速贴图绘制)
    this.initSprites();
  }

  initSprites() {
    // 预渲染泡沫气泡贴图 (32x32)
    this.foamCanvas = document.createElement('canvas');
    this.foamCanvas.width = 32;
    this.foamCanvas.height = 32;
    const fctx = this.foamCanvas.getContext('2d');
    const grad = fctx.createRadialGradient(12, 12, 2, 16, 16, 15);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.65, '#f0f9ff');
    grad.addColorStop(1, 'rgba(219, 234, 254, 0.4)');
    fctx.fillStyle = grad;
    fctx.beginPath();
    fctx.arc(16, 16, 14, 0, Math.PI * 2);
    fctx.fill();
    // 气泡高光
    fctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    fctx.lineWidth = 1.5;
    fctx.beginPath();
    fctx.arc(12, 12, 6, Math.PI * 1.2, Math.PI * 1.8);
    fctx.stroke();

    // 预渲染闪光星芒贴图 (32x32)
    this.sparkleCanvas = document.createElement('canvas');
    this.sparkleCanvas.width = 32;
    this.sparkleCanvas.height = 32;
    const sctx = this.sparkleCanvas.getContext('2d');
    sctx.fillStyle = '#fef08a';
    sctx.beginPath();
    sctx.moveTo(16, 2);
    sctx.quadraticCurveTo(16, 16, 30, 16);
    sctx.quadraticCurveTo(16, 16, 16, 30);
    sctx.quadraticCurveTo(16, 16, 2, 16);
    sctx.quadraticCurveTo(16, 16, 16, 2);
    sctx.fill();
    sctx.fillStyle = '#ffffff';
    sctx.beginPath();
    sctx.arc(16, 16, 3.5, 0, Math.PI * 2);
    sctx.fill();
  }

  reset() {
    this.particles = [];
    this.sparkles = [];
    this.floatingTexts = [];
  }

  /**
   * 喷洒泡沫颗粒 (轻量化限制)
   */
  emitFoam(x, y, count = 2) {
    if (this.particles.length >= this.maxParticles) {
      // 达到上限时直接复用或舍弃旧粒子
      this.particles.splice(0, count);
    }
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 26;
      const offsetY = (Math.random() - 0.5) * 26;
      const size = Math.random() * 12 + 14;
      this.particles.push({
        type: 'foam',
        x: x + offsetX,
        y: y + offsetY,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: size,
        alpha: 0.9,
        decay: 0.008 + Math.random() * 0.008
      });
    }
  }

  /**
   * 喷射高压水枪水花
   */
  emitWater(x, y, count = 4) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.splice(0, count);
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 30;
      this.particles.push({
        type: 'water',
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 20,
        radius: Math.random() * 2 + 1.5,
        alpha: 0.8,
        decay: 0.06
      });
    }
  }

  /**
   * 抹布擦拭抛光闪光粒子
   */
  emitSparkle(x, y) {
    if (this.sparkles.length >= 20) {
      this.sparkles.shift();
    }
    this.sparkles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      size: Math.random() * 10 + 16,
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 3,
      alpha: 1.0,
      decay: 0.04
    });
  }

  /**
   * 冲刷飞溅的脏污颗粒
   */
  emitDirtSplash(x, y, dirtColor, count = 2) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.splice(0, count);
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 20;
      this.particles.push({
        type: 'dirt',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 30,
        radius: Math.random() * 2 + 1,
        color: dirtColor,
        alpha: 0.8,
        decay: 0.08
      });
    }
  }

  addFloatingText(text, x, y, color = '#38bdf8') {
    if (this.floatingTexts.length >= 5) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      text,
      x: x,
      y: y - 10,
      vy: -30,
      alpha: 1.0,
      decay: 0.03,
      color
    });
  }

  update(dt) {
    // 快速迭代粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 闪光
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.rotation += s.rotSpeed * dt;
      s.alpha -= s.decay;
      if (s.alpha <= 0) {
        this.sparkles.splice(i, 1);
      }
    }

    // 浮动文字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= ft.decay;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // 1. 批量绘制泡沫（使用硬件加速贴图）
    for (const p of this.particles) {
      if (p.type === 'foam') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        const half = p.size / 2;
        ctx.drawImage(this.foamCanvas, p.x - half, p.y - half, p.size, p.size);
        ctx.restore();
      }
    }

    // 2. 批量绘制水滴与污泥水花 (单次路径绘制，极大节省性能)
    ctx.save();
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    for (const p of this.particles) {
      if (p.type === 'water') {
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // 污泥颗粒
    for (const p of this.particles) {
      if (p.type === 'dirt') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 3. 闪光贴图绘制
    for (const s of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      const half = s.size / 2;
      ctx.drawImage(this.sparkleCanvas, -half, -half, s.size, s.size);
      ctx.restore();
    }

    // 4. 浮动文字
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

window.ParticleSystem = ParticleSystem;
