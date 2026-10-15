// Polyfill for CanvasRenderingContext2D.prototype.roundRect to support all iOS / iPad versions
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

/**
 * Car Renderer for Car Wash Game
 * 1. 真实摄影原图直出：【不进行任何背景抠图或像素预处理】，保留图片原本纯正光影与质感
 * 2. 精确计算车辆绘制矩形，为污渍生成系统提供精准的车身定位范围
 */
class CarRenderer {
  static imageCache = {};

  /**
   * 计算图片在画布上的实际绘制尺寸与位置
   */
  static getDrawBounds(bounds, img) {
    const { x, y, width, height } = bounds;
    if (!img || !img.naturalWidth) return bounds;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW = width;
    let drawH = width / imgAspect;

    if (drawH > height * 1.05) {
      drawH = height * 1.05;
      drawW = drawH * imgAspect;
    }

    const drawX = x + (width - drawW) / 2;
    const drawY = y + (height - drawH) / 2;

    return { x: drawX, y: drawY, width: drawW, height: drawH };
  }

  /**
   * 绘制指定汽车与车漆
   */
  static render(ctx, carConfig, colorConfig, bounds) {
    ctx.save();

    const imageUrl = (colorConfig && colorConfig.imageUrl) || carConfig.imageUrl;
    const primaryColor = colorConfig.hex;
    const secondaryColor = colorConfig.secondaryHex || primaryColor;
    const finish = colorConfig.finish || 'metallic';

    // 优先渲染用户提供的真实摄影原图 (原汁原味，不做任何修改处理)
    if (imageUrl) {
      const rendered = this.renderRealCarImage(ctx, imageUrl, bounds);
      if (rendered) {
        ctx.restore();
        return;
      }
    }

    // 后备方案：仅在无原图时绘制矢量图及地面投影
    this.renderGroundShadow(ctx, bounds);
    const carType = carConfig.type || 'sedan_coupe';
    switch (carType) {
      case 'pickup_cyber':
        this.renderCybertruck(ctx, bounds, primaryColor, secondaryColor);
        break;
      case 'sedan_coupe':
      case 'suv_sport':
        this.renderXiaomiSU7(ctx, bounds, primaryColor, secondaryColor, finish);
        break;
      case 'crossover_ev':
        this.renderTeslaModelY(ctx, bounds, primaryColor, secondaryColor, finish);
        break;
      case 'supercar':
        this.renderFerrari(ctx, bounds, primaryColor, secondaryColor, finish);
        break;
      case 'hypercar':
        this.renderBugatti(ctx, bounds, primaryColor, secondaryColor, colorConfig.dualTone);
        break;
      case 'suv_ultra_luxury':
        this.renderRollsRoyceCullinan(ctx, bounds, primaryColor, secondaryColor, finish);
        break;
      case 'suv_rugged_box':
        this.renderMercedesGClass(ctx, bounds, primaryColor, secondaryColor, finish);
        break;
      default:
        this.renderBMWX3(ctx, bounds, primaryColor, secondaryColor, finish);
        break;
    }

    ctx.restore();
  }

  /**
   * 直接渲染原始真实车辆图片 (【不做任何抠图或滤镜预处理】，背景保持原图模样)
   */
  static renderRealCarImage(ctx, imageUrl, bounds) {
    let img = this.imageCache[imageUrl];
    if (!img) {
      img = new Image();
      img.src = imageUrl;
      this.imageCache[imageUrl] = img;
      return false;
    }

    if (!img.complete || img.naturalWidth === 0) {
      return false;
    }

    const drawBounds = this.getDrawBounds(bounds, img);

    ctx.save();
    // 带有圆角容器卡片效果，显得精致利落
    ctx.beginPath();
    ctx.roundRect(drawBounds.x, drawBounds.y, drawBounds.width, drawBounds.height, 12);
    ctx.clip();

    // 直接绘制原始真实照片
    ctx.drawImage(img, drawBounds.x, drawBounds.y, drawBounds.width, drawBounds.height);
    ctx.restore();

    // 细微轻柔边框
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(drawBounds.x, drawBounds.y, drawBounds.width, drawBounds.height, 12);
    ctx.stroke();
    ctx.restore();

    return true;
  }

  static renderGroundShadow(ctx, bounds) {
    const { x, y, width, height } = bounds;
    ctx.save();
    const shadowY = y + height * 0.94;
    const shadowGrad = ctx.createRadialGradient(
      x + width * 0.5, shadowY, width * 0.1,
      x + width * 0.5, shadowY, width * 0.52
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.5, shadowY, width * 0.48, height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static renderWheel(ctx, cx, cy, radius, rimColor = '#e2e8f0') {
    ctx.save();
    ctx.fillStyle = '#1c1d21';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0d0e10';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = rimColor;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(cx + radius * 0.22, cy - radius * 0.22, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = radius * 0.11;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius * 0.68, cy + Math.sin(angle) * radius * 0.68);
      ctx.stroke();
    }

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static renderCybertruck(ctx, bounds, primary, secondary) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.26;
    const wheelFrontX = x + width * 0.78;
    const wheelRearX = x + width * 0.22;
    const wheelY = y + height * 0.72;

    ctx.save();
    const cyberGrad = ctx.createLinearGradient(x, y, x + width, y + height);
    cyberGrad.addColorStop(0, '#cbd5e1');
    cyberGrad.addColorStop(0.3, '#94a3b8');
    cyberGrad.addColorStop(0.6, '#64748b');
    cyberGrad.addColorStop(1, '#475569');

    ctx.fillStyle = cyberGrad;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.06, y + height * 0.72);
    ctx.lineTo(x + width * 0.05, y + height * 0.45);
    ctx.lineTo(x + width * 0.44, y + height * 0.18);
    ctx.lineTo(x + width * 0.88, y + height * 0.45);
    ctx.lineTo(x + width * 0.94, y + height * 0.54);
    ctx.lineTo(x + width * 0.92, y + height * 0.72);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.15, y + height * 0.72);
    ctx.lineTo(wheelFrontX + wheelRadius * 0.85, y + height * 0.54);
    ctx.lineTo(wheelFrontX - wheelRadius * 0.85, y + height * 0.54);
    ctx.lineTo(wheelFrontX - wheelRadius * 1.15, y + height * 0.72);
    ctx.lineTo(wheelRearX + wheelRadius * 1.15, y + height * 0.72);
    ctx.lineTo(wheelRearX + wheelRadius * 0.85, y + height * 0.54);
    ctx.lineTo(wheelRearX - wheelRadius * 0.85, y + height * 0.54);
    ctx.lineTo(wheelRearX - wheelRadius * 1.15, y + height * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fillRect(x + width * 0.86, y + height * 0.45, width * 0.08, 4);
    ctx.shadowBlur = 0;

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius, '#1e293b');
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius, '#1e293b');
    ctx.restore();
  }

  static renderXiaomiSU7(ctx, bounds, primary, secondary, finish) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.22;
    const wheelFrontX = x + width * 0.78;
    const wheelRearX = x + width * 0.22;
    const wheelY = y + height * 0.74;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.08, y + height * 0.75);
    ctx.lineTo(x + width * 0.06, y + height * 0.58);
    ctx.quadraticCurveTo(x + width * 0.08, y + height * 0.46, x + width * 0.18, y + height * 0.46);
    ctx.quadraticCurveTo(x + width * 0.35, y + height * 0.24, x + width * 0.52, y + height * 0.24);
    ctx.quadraticCurveTo(x + width * 0.72, y + height * 0.26, x + width * 0.82, y + height * 0.48);
    ctx.quadraticCurveTo(x + width * 0.94, y + height * 0.54, x + width * 0.95, y + height * 0.64);
    ctx.lineTo(x + width * 0.92, y + height * 0.75);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.08, y + height * 0.75);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.12, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.08, y + height * 0.75);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.12, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.08, y + height * 0.75);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius);
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius);
    ctx.restore();
  }

  static renderTeslaModelY(ctx, bounds, primary, secondary, finish) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.22;
    const wheelFrontX = x + width * 0.77;
    const wheelRearX = x + width * 0.23;
    const wheelY = y + height * 0.74;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.09, y + height * 0.75);
    ctx.lineTo(x + width * 0.07, y + height * 0.55);
    ctx.quadraticCurveTo(x + width * 0.12, y + height * 0.42, x + width * 0.25, y + height * 0.32);
    ctx.quadraticCurveTo(x + width * 0.48, y + height * 0.20, x + width * 0.65, y + height * 0.28);
    ctx.quadraticCurveTo(x + width * 0.8, y + height * 0.42, x + width * 0.94, y + height * 0.58);
    ctx.quadraticCurveTo(x + width * 0.95, y + height * 0.66, x + width * 0.91, y + height * 0.75);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.1, y + height * 0.75);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.1, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.1, y + height * 0.75);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.1, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.09, y + height * 0.75);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius, '#1e293b');
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius, '#1e293b');
    ctx.restore();
  }

  static renderFerrari(ctx, bounds, primary, secondary, finish) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.24;
    const wheelFrontX = x + width * 0.78;
    const wheelRearX = x + width * 0.20;
    const wheelY = y + height * 0.73;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.06, y + height * 0.74);
    ctx.lineTo(x + width * 0.05, y + height * 0.58);
    ctx.lineTo(x + width * 0.12, y + height * 0.44);
    ctx.quadraticCurveTo(x + width * 0.32, y + height * 0.30, x + width * 0.48, y + height * 0.28);
    ctx.quadraticCurveTo(x + width * 0.68, y + height * 0.32, x + width * 0.85, y + height * 0.54);
    ctx.lineTo(x + width * 0.96, y + height * 0.68);
    ctx.lineTo(x + width * 0.90, y + height * 0.74);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.1, y + height * 0.74);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.1, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.1, y + height * 0.74);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.1, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.06, y + height * 0.74);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius, '#e2e8f0');
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius, '#e2e8f0');
    ctx.restore();
  }

  static renderBugatti(ctx, bounds, primary, secondary, isDualTone) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.24;
    const wheelFrontX = x + width * 0.76;
    const wheelRearX = x + width * 0.20;
    const wheelY = y + height * 0.73;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.06, y + height * 0.74);
    ctx.lineTo(x + width * 0.05, y + height * 0.52);
    ctx.quadraticCurveTo(x + width * 0.15, y + height * 0.36, x + width * 0.28, y + height * 0.29);
    ctx.quadraticCurveTo(x + width * 0.5, y + height * 0.22, x + width * 0.68, y + height * 0.28);
    ctx.quadraticCurveTo(x + width * 0.84, y + height * 0.42, x + width * 0.94, y + height * 0.56);
    ctx.lineTo(x + width * 0.92, y + height * 0.74);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.1, y + height * 0.74);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.1, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.1, y + height * 0.74);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.1, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.06, y + height * 0.74);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius, '#cbd5e1');
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius, '#cbd5e1');
    ctx.restore();
  }

  static renderRollsRoyceCullinan(ctx, bounds, primary, secondary, finish) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.24;
    const wheelFrontX = x + width * 0.76;
    const wheelRearX = x + width * 0.20;
    const wheelY = y + height * 0.73;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.06, y + height * 0.74);
    ctx.lineTo(x + width * 0.05, y + height * 0.42);
    ctx.lineTo(x + width * 0.16, y + height * 0.22);
    ctx.lineTo(x + width * 0.60, y + height * 0.20);
    ctx.lineTo(x + width * 0.72, y + height * 0.36);
    ctx.lineTo(x + width * 0.94, y + height * 0.38);
    ctx.lineTo(x + width * 0.95, y + height * 0.74);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.15, y + height * 0.74);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.15, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.15, y + height * 0.74);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.15, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.06, y + height * 0.74);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius, '#f8fafc');
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius, '#f8fafc');
    ctx.restore();
  }

  static renderMercedesGClass(ctx, bounds, primary, secondary, finish) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.25;
    const wheelFrontX = x + width * 0.75;
    const wheelRearX = x + width * 0.20;
    const wheelY = y + height * 0.72;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.08, y + height * 0.73);
    ctx.lineTo(x + width * 0.06, y + height * 0.22);
    ctx.lineTo(x + width * 0.65, y + height * 0.21);
    ctx.lineTo(x + width * 0.70, y + height * 0.38);
    ctx.lineTo(x + width * 0.93, y + height * 0.40);
    ctx.lineTo(x + width * 0.94, y + height * 0.73);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.18, y + height * 0.73);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.18, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.18, y + height * 0.73);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.18, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.08, y + height * 0.73);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius, '#334155');
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius, '#334155');
    ctx.restore();
  }

  static renderBMWX3(ctx, bounds, primary, secondary, finish) {
    const { x, y, width, height } = bounds;
    const wheelRadius = height * 0.23;
    const wheelFrontX = x + width * 0.75;
    const wheelRearX = x + width * 0.21;
    const wheelY = y + height * 0.73;

    ctx.save();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.08, y + height * 0.74);
    ctx.lineTo(x + width * 0.06, y + height * 0.48);
    ctx.quadraticCurveTo(x + width * 0.12, y + height * 0.32, x + width * 0.22, y + height * 0.24);
    ctx.lineTo(x + width * 0.62, y + height * 0.22);
    ctx.quadraticCurveTo(x + width * 0.74, y + height * 0.28, x + width * 0.84, y + height * 0.42);
    ctx.quadraticCurveTo(x + width * 0.94, y + height * 0.48, x + width * 0.93, y + height * 0.66);
    ctx.lineTo(x + width * 0.88, y + height * 0.74);
    ctx.lineTo(wheelFrontX + wheelRadius * 1.12, y + height * 0.74);
    ctx.arc(wheelFrontX, wheelY, wheelRadius * 1.12, 0, Math.PI, true);
    ctx.lineTo(wheelRearX + wheelRadius * 1.12, y + height * 0.74);
    ctx.arc(wheelRearX, wheelY, wheelRadius * 1.12, 0, Math.PI, true);
    ctx.lineTo(x + width * 0.08, y + height * 0.74);
    ctx.closePath();
    ctx.fill();

    this.renderWheel(ctx, wheelRearX, wheelY, wheelRadius);
    this.renderWheel(ctx, wheelFrontX, wheelY, wheelRadius);
    ctx.restore();
  }
}

window.CarRenderer = CarRenderer;
