/**
 * Dirt & Surface Wash Manager for Car Wash Game
 * 智能污渍定位：【严格限制在真实车身、车窗、机盖与车轮区域】，绝不出现在车外空中或地面
 */

class DirtManager {
  constructor() {
    this.spots = [];
    this.surfaceFoams = [];
    this.maxSurfaceFoams = 50;
    this.totalInitialHealth = 0;
    this.currentDirtLevel = 'medium';
    this.carBounds = { x: 100, y: 150, width: 600, height: 260 };
    this.lastFoamTime = 0;
    this.lastSparkleTime = 0;
  }

  /**
   * 初始化并生成车辆污垢 (只出现在车身上)
   */
  generateDirt(levelId = 'medium', carBounds) {
    this.currentDirtLevel = levelId;
    if (carBounds) {
      this.carBounds = carBounds;
    }

    const levelConfig = DIRT_LEVELS[levelId] || DIRT_LEVELS.medium;
    this.spots = [];
    this.surfaceFoams = [];

    const minSpots = levelConfig.spotCountRange[0];
    const maxSpots = levelConfig.spotCountRange[1];
    const totalCount = Math.floor(minSpots + Math.random() * (maxSpots - minSpots + 1));

    const mudCount = Math.max(2, Math.round(totalCount * 0.4));
    const dustCount = Math.max(2, Math.round(totalCount * 0.3));
    const ketchupCount = Math.max(1, Math.round(totalCount * 0.15));
    const poopCount = Math.max(1, totalCount - mudCount - dustCount - ketchupCount);

    // 严格限制在车身各部位
    this.createSpotsOfType(DIRT_TYPES.MUD, mudCount, levelConfig, 'lower_and_wheels');
    this.createSpotsOfType(DIRT_TYPES.DUST, dustCount, levelConfig, 'body_and_windows');
    this.createSpotsOfType(DIRT_TYPES.KETCHUP, ketchupCount, levelConfig, 'hood_and_doors');
    this.createSpotsOfType(DIRT_TYPES.POOP, poopCount, levelConfig, 'roof_and_windshield');

    this.totalInitialHealth = this.spots.reduce((sum, s) => sum + s.maxHealth, 0);
  }

  createSpotsOfType(typeConfig, count, levelConfig, distributionArea) {
    const cb = this.carBounds;
    for (let i = 0; i < count; i++) {
      let x, y;

      // 【智能车身坐标映射】：
      // 水平避开左右空隙 [0.15 ~ 0.85]
      // 垂直避开顶部天空 [0.28+] 和 底部地面 [<= 0.74]
      if (distributionArea === 'lower_and_wheels') {
        // 车身下裙、轮眉与车轮
        x = cb.x + cb.width * (0.15 + Math.random() * 0.70);
        y = cb.y + cb.height * (0.54 + Math.random() * 0.20);
      } else if (distributionArea === 'hood_and_doors') {
        // 机盖与车门中央主立面
        x = cb.x + cb.width * (0.20 + Math.random() * 0.62);
        y = cb.y + cb.height * (0.38 + Math.random() * 0.24);
      } else if (distributionArea === 'roof_and_windshield') {
        // 车顶与前后挡风玻璃
        x = cb.x + cb.width * (0.28 + Math.random() * 0.44);
        y = cb.y + cb.height * (0.30 + Math.random() * 0.18);
      } else {
        // 车身主体综合区域
        x = cb.x + cb.width * (0.18 + Math.random() * 0.64);
        y = cb.y + cb.height * (0.35 + Math.random() * 0.35);
      }

      const baseRadius = (Math.random() * 16 + 13) * levelConfig.spotSizeScale;
      const numPoints = 8;
      const points = [];
      for (let p = 0; p < numPoints; p++) {
        const angle = (p / numPoints) * Math.PI * 2;
        const radDist = baseRadius * (0.7 + Math.random() * 0.6);
        points.push({
          x: Math.cos(angle) * radDist,
          y: Math.sin(angle) * radDist
        });
      }

      const splatters = [];
      const splatterCount = Math.floor(Math.random() * 3 + 2);
      for (let s = 0; s < splatterCount; s++) {
        const sAngle = Math.random() * Math.PI * 2;
        const sDist = baseRadius * (1.1 + Math.random() * 0.5);
        splatters.push({
          x: Math.cos(sAngle) * sDist,
          y: Math.sin(sAngle) * sDist,
          r: (Math.random() * 3 + 1.5) * levelConfig.spotSizeScale
        });
      }

      const spotHealth = typeConfig.baseHealth * levelConfig.healthMultiplier * 100;

      this.spots.push({
        id: `spot_${Date.now()}_${Math.random()}`,
        type: typeConfig,
        x,
        y,
        radius: baseRadius,
        points,
        splatters,
        maxHealth: spotHealth,
        currentHealth: spotHealth,
        isSoftened: false,
        softenFactor: 1.0,
        foamCoverage: 0,
        cleaned: false
      });
    }
  }

  interact(tool, x, y, particleSystem) {
    const now = performance.now();
    const toolRadius = tool.radius;

    // 1. 全车喷泡沫
    if (tool.id === 'foam') {
      particleSystem.emitFoam(x, y, 2);

      if (now - this.lastFoamTime > 45) {
        this.lastFoamTime = now;
        if (this.surfaceFoams.length >= this.maxSurfaceFoams) {
          this.surfaceFoams.shift();
        }
        this.surfaceFoams.push({
          x: x + (Math.random() - 0.5) * 14,
          y: y + (Math.random() - 0.5) * 14,
          radius: Math.random() * 12 + 16,
          alpha: 0.92
        });
      }
    }

    // 2. 全车冲水
    if (tool.id === 'water') {
      particleSystem.emitWater(x, y, 3);
      for (let i = this.surfaceFoams.length - 1; i >= 0; i--) {
        const f = this.surfaceFoams[i];
        if (Math.hypot(f.x - x, f.y - y) < toolRadius + f.radius) {
          f.alpha -= 0.35;
          if (f.alpha <= 0) {
            this.surfaceFoams.splice(i, 1);
          }
        }
      }
    }

    // 3. 全车布擦
    if (tool.id === 'cloth') {
      for (let i = this.surfaceFoams.length - 1; i >= 0; i--) {
        const f = this.surfaceFoams[i];
        if (Math.hypot(f.x - x, f.y - y) < toolRadius + f.radius) {
          f.alpha -= 0.5;
          if (f.alpha <= 0) {
            this.surfaceFoams.splice(i, 1);
          }
        }
      }

      if (now - this.lastSparkleTime > 120) {
        this.lastSparkleTime = now;
        particleSystem.emitSparkle(x, y);
      }
    }

    // 4. 清除污渍判定
    let affectedCount = 0;
    for (const spot of this.spots) {
      if (spot.cleaned) continue;

      const dist = Math.hypot(spot.x - x, spot.y - y);
      const maxHitDist = spot.radius + toolRadius;

      if (dist < maxHitDist) {
        affectedCount++;
        const proximity = Math.max(0.2, 1 - (dist / maxHitDist));

        if (tool.id === 'foam') {
          spot.foamCoverage = Math.min(1.0, spot.foamCoverage + 0.35);
          spot.isSoftened = true;
          spot.softenFactor = 1.6;
          const damage = tool.cleanPower * (spot.type.weakness.foam || 1.0) * proximity * 3.5;
          spot.currentHealth = Math.max(0, spot.currentHealth - damage);
        } else if (tool.id === 'water') {
          const weaknessMul = spot.type.weakness.water || 1.0;
          const softenMul = spot.isSoftened ? spot.softenFactor : 1.0;
          const damage = tool.cleanPower * weaknessMul * softenMul * proximity * 5.5;
          spot.currentHealth = Math.max(0, spot.currentHealth - damage);
          if (spot.foamCoverage > 0) spot.foamCoverage = Math.max(0, spot.foamCoverage - 0.3);
          particleSystem.emitDirtSplash(spot.x, spot.y, spot.type.color, 1);
        } else if (tool.id === 'cloth') {
          const weaknessMul = spot.type.weakness.cloth || 1.0;
          const softenMul = spot.isSoftened ? 1.3 : 1.0;
          const damage = tool.cleanPower * weaknessMul * softenMul * proximity * 4.8;
          spot.currentHealth = Math.max(0, spot.currentHealth - damage);
          spot.foamCoverage = Math.max(0, spot.foamCoverage - 0.4);
        }

        if (spot.currentHealth <= 0 && !spot.cleaned) {
          spot.cleaned = true;
          particleSystem.emitSparkle(spot.x, spot.y);
          particleSystem.emitSparkle(spot.x + 8, spot.y - 8);
          particleSystem.addFloatingText('✨ Clean!', spot.x, spot.y - 12, '#38bdf8');
          if (window.soundEngine) {
            window.soundEngine.playSparkle();
          }
        }
      }
    }

    return { affected: affectedCount > 0 };
  }

  getCleanlinessPercentage() {
    if (this.spots.length === 0 || this.totalInitialHealth === 0) return 100.0;
    const remainingHealth = this.spots.reduce((sum, s) => {
      return sum + (s.cleaned ? 0 : s.currentHealth);
    }, 0);

    const percent = ((1 - remainingHealth / this.totalInitialHealth) * 100);
    const clamped = Math.min(100.0, Math.max(0.0, percent));

    if (this.spots.every(s => s.cleaned) || clamped >= GAME_CONFIG.CLEAN_WIN_THRESHOLD) {
      return 100.0;
    }
    return Math.round(clamped * 10) / 10;
  }

  draw(ctx) {
    // 绘制污渍斑块
    for (const spot of this.spots) {
      if (spot.cleaned) continue;

      const healthRatio = spot.currentHealth / spot.maxHealth;
      const alpha = Math.min(0.95, Math.max(0.18, healthRatio));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = spot.type.color;

      ctx.beginPath();
      const firstPt = spot.points[0];
      ctx.moveTo(spot.x + firstPt.x, spot.y + firstPt.y);
      for (let i = 1; i < spot.points.length; i++) {
        const pt = spot.points[i];
        ctx.lineTo(spot.x + pt.x, spot.y + pt.y);
      }
      ctx.closePath();
      ctx.fill();

      // 番茄酱黏光
      if (spot.type.id === 'ketchup') {
        ctx.fillStyle = 'rgba(255, 120, 120, 0.4)';
        ctx.beginPath();
        ctx.arc(spot.x - spot.radius * 0.2, spot.y - spot.radius * 0.2, spot.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // 飞溅碎点
      ctx.fillStyle = spot.type.color;
      for (const sp of spot.splatters) {
        ctx.beginPath();
        ctx.arc(spot.x + sp.x, spot.y + sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 绘制喷洒在车上的泡沫层
    if (this.surfaceFoams.length > 0) {
      ctx.save();
      for (const sf of this.surfaceFoams) {
        ctx.globalAlpha = Math.max(0, sf.alpha * 0.9);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sf.x, sf.y, sf.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

window.DirtManager = DirtManager;
