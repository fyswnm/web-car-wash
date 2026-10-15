/**
 * Main Game Controller for Car Wash Game
 * 管理计时 (3分钟限制)、输入触控、评分系统 (S/A/B/C/F)、车辆切换与界面联动
 */

class CarWashGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 模块实例
    this.dirtManager = new DirtManager();
    this.particleSystem = new ParticleSystem();

    // 游戏状态
    this.currentCar = CarRegistry.getCar('xiaomi_su7');
    this.currentColor = this.currentCar.colors[0];
    this.currentDirtLevel = 'medium'; // 'light' | 'medium' | 'heavy'
    this.currentTool = TOOLS.FOAM;

    this.gameState = 'idle'; // 'idle' | 'playing' | 'won' | 'timeout'
    this.timeRemaining = GAME_CONFIG.MAX_TIME_SECONDS;
    this.elapsedTime = 0;
    this.timerInterval = null;

    // 触控交互状态
    this.isInteracting = false;
    this.lastPointer = { x: 0, y: 0 };
    this.cursorPos = { x: -100, y: -100, visible: false };

    // 画布与车辆缩放尺寸
    this.dpr = window.devicePixelRatio || 1;
    this.carBounds = { x: 0, y: 0, width: 0, height: 0 };

    this.init();
  }

  async init() {
    if (CarRegistry.initAdaptiveCars) {
      await CarRegistry.initAdaptiveCars();
    }
    const allCars = CarRegistry.getAllCars();
    if (allCars.length > 0) {
      // 默认优先选择 小米 SU7 海湾蓝
      const su7 = allCars.find(c => c.name.includes('小米') && c.name.toLowerCase().includes('su7')) || allCars[0];
      this.currentCar = su7;
      if (su7 && su7.colors && su7.colors.length > 0) {
        const gulfBlue = su7.colors.find(c => c.name.includes('海湾蓝') || c.name.includes('蓝')) || su7.colors[0];
        this.currentColor = gulfBlue;
      }
    }
    this.setupResize();
    this.bindEvents();
    this.renderCarSelectUI();
    this.startNewGame();
    this.gameLoop();
  }

  /**
   * 适配视口及 Retina 屏高清渲染
   */
  setupResize() {
    const resize = () => {
      const container = this.canvas.parentElement;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.ctx.resetTransform();
      this.ctx.scale(this.dpr, this.dpr);

      // 计算车辆居中显示区域
      const carW = Math.min(w * 0.92, 860);
      const carH = carW * 0.44;
      const carX = (w - carW) / 2;
      const carY = (h - carH) / 2 - 20;

      this.carBounds = { x: carX, y: carY, width: carW, height: carH };
      if (this.dirtManager) {
        this.dirtManager.carBounds = this.carBounds;
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();
  }

  /**
   * 绑定事件监听 (同时支持鼠标与触摸操作)
   */
  bindEvents() {
    const c = this.canvas;

    const getCanvasPoint = (e) => {
      const rect = c.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handleStart = (e) => {
      e.preventDefault();
      if (this.gameState !== 'playing') return;

      if (window.soundEngine) {
        window.soundEngine.resume();
      }

      this.isInteracting = true;
      const pt = getCanvasPoint(e);
      this.lastPointer = pt;
      this.cursorPos = { x: pt.x, y: pt.y, visible: true };

      if (window.soundEngine) {
        window.soundEngine.startToolAudio(this.currentTool.id);
      }
      this.triggerInteraction(pt.x, pt.y);
    };

    const handleMove = (e) => {
      const pt = getCanvasPoint(e);
      this.cursorPos = { x: pt.x, y: pt.y, visible: true };

      if (!this.isInteracting || this.gameState !== 'playing') return;
      e.preventDefault();

      // 平滑清洗轨迹并限制最大步数，保证 120Hz 手机/平板不掉帧
      const dx = pt.x - this.lastPointer.x;
      const dy = pt.y - this.lastPointer.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(3, Math.max(1, Math.floor(dist / 20)));

      for (let s = 1; s <= steps; s++) {
        const ix = this.lastPointer.x + (dx * s) / steps;
        const iy = this.lastPointer.y + (dy * s) / steps;
        this.triggerInteraction(ix, iy);
      }

      this.lastPointer = pt;
    };

    const handleEnd = (e) => {
      if (!this.isInteracting) return;
      this.isInteracting = false;
      if (window.soundEngine) {
        window.soundEngine.stopToolAudio();
      }
    };

    // 触摸事件
    c.addEventListener('touchstart', handleStart, { passive: false });
    c.addEventListener('touchmove', handleMove, { passive: false });
    c.addEventListener('touchend', handleEnd, { passive: false });
    c.addEventListener('touchcancel', handleEnd, { passive: false });

    // 鼠标事件
    c.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    c.addEventListener('mouseleave', () => {
      this.cursorPos.visible = false;
    });

    // 键盘快捷键切换工具 (1: 泡沫, 2: 水枪, 3: 抹布)
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.selectTool('foam');
      if (e.key === '2') this.selectTool('water');
      if (e.key === '3') this.selectTool('cloth');
    });

    // 工具栏点击事件
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const toolId = btn.dataset.tool;
        this.selectTool(toolId);
      });
    });

    // 难度等级选择
    document.querySelectorAll('.level-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const level = pill.dataset.level;
        this.changeDirtLevel(level);
      });
    });

    // 音效静音切换
    const muteBtn = document.getElementById('muteToggleBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const muted = window.soundEngine.toggleMute();
        muteBtn.textContent = muted ? '🔇 静音' : '🔊 声音';
        muteBtn.classList.toggle('active', !muted);
      });
    }

    // 换车弹窗按钮
    const carModalBtn = document.getElementById('openCarModalBtn');
    if (carModalBtn) {
      carModalBtn.addEventListener('click', () => {
        this.openCarModal();
      });
    }

    // 关闭换车弹窗
    const closeCarModalBtn = document.getElementById('closeCarModalBtn');
    if (closeCarModalBtn) {
      closeCarModalBtn.addEventListener('click', () => {
        this.closeCarModal();
      });
    }

    // 重新洗车 / 重置本车
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.startNewGame();
      });
    }

    // 结算弹窗按钮
    const retryBtn = document.getElementById('resultRetryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.hideResultModal();
        this.startNewGame();
      });
    }

    const changeCarBtn = document.getElementById('resultChangeCarBtn');
    if (changeCarBtn) {
      changeCarBtn.addEventListener('click', () => {
        this.hideResultModal();
        this.openCarModal();
      });
    }
  }

  /**
   * 触发清洗核心逻辑
   */
  triggerInteraction(x, y) {
    if (this.gameState !== 'playing') return;

    // 触感反馈 (支持的手机与平板)
    if (navigator.vibrate && Math.random() < 0.2) {
      try { navigator.vibrate(12); } catch (e) {}
    }

    const result = this.dirtManager.interact(this.currentTool, x, y, this.particleSystem);

    // 实时更新清洁进度
    const progress = this.dirtManager.getCleanlinessPercentage();
    this.updateProgressUI(progress);

    // 判定通关: 达到100%
    if (progress >= 100.0) {
      this.handleGameWin();
    }
  }

  /**
   * 选择洗车工具
   */
  selectTool(toolId) {
    const key = toolId.toUpperCase();
    if (!TOOLS[key]) return;
    this.currentTool = TOOLS[key];

    if (window.soundEngine) {
      window.soundEngine.playClick();
      if (this.isInteracting) {
        window.soundEngine.startToolAudio(this.currentTool.id);
      }
    }

    // 更新工具栏激活状态
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });

    const tip = document.getElementById('toolTipText');
    if (tip) {
      tip.textContent = `${this.currentTool.name}: ${this.currentTool.desc}`;
    }
  }

  /**
   * 调整车辆脏的程度 (轻微脏 / 一般脏 / 很脏)
   */
  changeDirtLevel(levelId) {
    if (!DIRT_LEVELS[levelId]) return;
    this.currentDirtLevel = levelId;

    if (window.soundEngine) {
      window.soundEngine.playClick();
    }

    document.querySelectorAll('.level-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.level === levelId);
    });

    // 重新生成对应脏污
    this.startNewGame();
  }

  /**
   * 开始一局新游戏
   */
  startNewGame() {
    this.gameState = 'playing';
    this.timeRemaining = GAME_CONFIG.MAX_TIME_SECONDS;
    this.elapsedTime = 0;
    this.isInteracting = false;

    if (window.soundEngine) {
      window.soundEngine.stopToolAudio();
    }

    // 计算当前车辆实际图片的精确定位边界，确保污渍100%严格分布在车身范围内
    const imgUrl = (this.currentColor && this.currentColor.imageUrl) || (this.currentCar && this.currentCar.imageUrl);
    let effectiveBounds = this.carBounds;
    if (imgUrl && CarRenderer.imageCache[imgUrl] && CarRenderer.imageCache[imgUrl].complete) {
      effectiveBounds = CarRenderer.getDrawBounds(this.carBounds, CarRenderer.imageCache[imgUrl]);
    } else if (imgUrl) {
      const tempImg = new Image();
      tempImg.src = imgUrl;
      CarRenderer.imageCache[imgUrl] = tempImg;
      tempImg.onload = () => {
        if (this.dirtManager) {
          const bounds = CarRenderer.getDrawBounds(this.carBounds, tempImg);
          this.dirtManager.carBounds = bounds;
        }
      };
    }
    this.dirtManager.generateDirt(this.currentDirtLevel, effectiveBounds);

    // 更新界面
    this.updateProgressUI(this.dirtManager.getCleanlinessPercentage());
    this.updateTimerUI();
    this.updateCarHeaderInfo();

    // 启动计时器
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.gameState === 'playing') {
        this.timeRemaining--;
        this.elapsedTime++;
        this.updateTimerUI();

        // 最后30秒音效警告
        if (this.timeRemaining <= GAME_CONFIG.WARNING_TIME_SECONDS && this.timeRemaining > 0) {
          if (window.soundEngine && this.timeRemaining % 2 === 0) {
            window.soundEngine.playTick();
          }
        }

        // 超时判定：3分钟时间到自动停止
        if (this.timeRemaining <= 0) {
          this.handleTimeout();
        }
      }
    }, 1000);
  }

  /**
   * 100% 洗净通关处理
   */
  handleGameWin() {
    this.gameState = 'won';
    clearInterval(this.timerInterval);
    if (window.soundEngine) {
      window.soundEngine.stopToolAudio();
      window.soundEngine.playWinFanfare();
    }

    // 庆祝粒子喷发
    for (let i = 0; i < 40; i++) {
      const rx = this.carBounds.x + Math.random() * this.carBounds.width;
      const ry = this.carBounds.y + Math.random() * this.carBounds.height;
      this.particleSystem.emitSparkle(rx, ry);
    }

    const rating = this.calculateRating(this.elapsedTime, 100, this.currentDirtLevel, false);
    setTimeout(() => {
      this.showResultModal(rating, true);
    }, 600);
  }

  /**
   * 超时处理 (满3分钟自动停止)
   */
  handleTimeout() {
    this.gameState = 'timeout';
    clearInterval(this.timerInterval);
    if (window.soundEngine) {
      window.soundEngine.stopToolAudio();
      window.soundEngine.playTimeout();
    }

    const currentPercent = this.dirtManager.getCleanlinessPercentage();
    const rating = this.calculateRating(GAME_CONFIG.MAX_TIME_SECONDS, currentPercent, this.currentDirtLevel, true);

    this.showResultModal(rating, false);
  }

  /**
   * 评分系统核心算法 (根据用户洗车耗时精确评级)
   * 规则：
   * - < 20s: S
   * - 20s ~ 60s: A
   * - 60s ~ 120s: B
   * - 120s ~ 180s: C
   * - 没洗完 / 超时未达100%: F
   */
  calculateRating(timeSpent, cleanliness, dirtLevel, isTimeout) {
    let grade = 'F';
    let title = '';
    let comment = '';
    let stars = 1;

    // 没洗完 (清洁度未达到 100% 或 超时未完成) 直接判定为 F
    if (cleanliness < 100.0 || isTimeout) {
      grade = 'F';
      title = '未完成！交车失败';
      comment = `【F级差评】未能彻底洗净车辆 (当前仅达 ${cleanliness.toFixed(1)}%)，且时间耗尽。顾客拒收并表示洗车小哥需要抓紧提升熟练度！`;
      stars = 1;
      return { grade, title, comment, stars, timeSpent, cleanliness };
    }

    // 100% 洗净通关，严格根据耗时判定
    if (timeSpent < 20) {
      grade = 'S';
      title = '神级极速！至尊精洗大师';
      comment = `【S级至尊好评】耗时仅 ${timeSpent} 秒 (<20s) 便彻底洗净全车！手速惊人，漆面如镜面般闪亮，车主惊喜万分并给出了五星好评！`;
      stars = 5;
    } else if (timeSpent <= 60) {
      grade = 'A';
      title = '极度满意！高效专业';
      comment = `【A级优质服务】耗时 ${timeSpent} 秒 (20s~60s)，冲刷与擦拭节奏完美，车身整洁亮丽，车主非常满意！`;
      stars = 4;
    } else if (timeSpent <= 120) {
      grade = 'B';
      title = '良好满意！达标交车';
      comment = `【B级良好服务】耗时 ${timeSpent} 秒 (60s~120s)，污渍全部清除，洗车流程规范扎实。`;
      stars = 3;
    } else {
      grade = 'C';
      title = '合格完工！用时稍长';
      comment = `【C级合格服务】耗时 ${timeSpent} 秒 (120s~180s)，虽然完成了 100% 清洁，但车主等待稍久。`;
      stars = 2;
    }

    return { grade, title, comment, stars, timeSpent, cleanliness };
  }

  /**
   * 更新清洁度百分比显示
   */
  updateProgressUI(percent) {
    const textEl = document.getElementById('progressText');
    const barEl = document.getElementById('progressBarFill');
    if (textEl) {
      textEl.textContent = `${percent.toFixed(1)}%`;
    }
    if (barEl) {
      barEl.style.width = `${percent}%`;
    }
  }

  /**
   * 更新计时器显示
   */
  updateTimerUI() {
    const timerEl = document.getElementById('timerText');
    const timerBox = document.getElementById('timerBox');
    if (!timerEl) return;

    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    timerEl.textContent = formatted;

    // 最后30秒增加紧急警示样式
    if (timerBox) {
      timerBox.classList.toggle('warning', this.timeRemaining <= GAME_CONFIG.WARNING_TIME_SECONDS);
    }
  }

  updateCarHeaderInfo() {
    const titleEl = document.getElementById('currentCarTitle');
    const badgeEl = document.getElementById('currentCarBadge');
    if (titleEl) {
      titleEl.textContent = `${this.currentCar.name} · ${this.currentColor.name}`;
    }
    if (badgeEl) {
      badgeEl.textContent = this.currentCar.badge || this.currentCar.brand;
    }
  }

  /**
   * 渲染选车弹窗 (包含全部 11 款车和丰富官方爆款颜色)
   */
  renderCarSelectUI() {
    const listContainer = document.getElementById('carSelectList');
    if (!listContainer) return;

    const allCars = CarRegistry.getAllCars();
    listContainer.innerHTML = '';

    allCars.forEach(car => {
      const card = document.createElement('div');
      card.className = `car-card ${car.id === this.currentCar.id ? 'selected' : ''}`;
      card.dataset.carId = car.id;

      // 颜色球
      const swatchesHtml = car.colors.map((c, idx) => `
        <button class="color-dot ${c.id === this.currentColor.id && car.id === this.currentCar.id ? 'active' : ''}" 
                style="background-color: ${c.hex};" 
                title="${c.name}" 
                data-color-id="${c.id}">
        </button>
      `).join('');

      const imgHtml = car.imageUrl 
        ? `<div class="car-card-img-wrap"><img src="${car.imageUrl}" alt="${car.name}" class="car-card-img" loading="lazy" /></div>` 
        : '';

      card.innerHTML = `
        <div class="car-card-header">
          <span class="car-brand">${car.brand}</span>
          <span class="car-badge">${car.badge}</span>
        </div>
        ${imgHtml}
        <div class="car-card-name">${car.name}</div>
        <div class="car-card-desc">${car.description}</div>
        <div class="car-colors-label">官方爆款配色:</div>
        <div class="car-color-swatches">
          ${swatchesHtml}
        </div>
      `;

      // 监听卡片点击
      card.addEventListener('click', (e) => {
        const dot = e.target.closest('.color-dot');
        if (dot) {
          const colorId = dot.dataset.colorId;
          const color = car.colors.find(c => c.id === colorId);
          this.selectCarAndColor(car, color);
        } else {
          // 默认选中第一款颜色
          this.selectCarAndColor(car, car.colors[0]);
        }
      });

      listContainer.appendChild(card);
    });
  }

  selectCarAndColor(car, color) {
    this.currentCar = car;
    this.currentColor = color || car.colors[0];

    // 更新列表激活状态
    document.querySelectorAll('.car-card').forEach(c => {
      const isSel = c.dataset.carId === car.id;
      c.classList.toggle('selected', isSel);
      if (isSel) {
        c.querySelectorAll('.color-dot').forEach(dot => {
          dot.classList.toggle('active', dot.dataset.colorId === this.currentColor.id);
        });
        const cardImg = c.querySelector('.car-card-img');
        if (cardImg && this.currentColor.imageUrl) {
          cardImg.src = this.currentColor.imageUrl;
        }
      }
    });

    if (window.soundEngine) {
      window.soundEngine.playClick();
    }
    this.updateCarHeaderInfo();
    this.closeCarModal();
    this.startNewGame();
  }

  openCarModal() {
    const modal = document.getElementById('carSelectModal');
    if (modal) modal.classList.add('visible');
    if (window.soundEngine) window.soundEngine.playClick();
  }

  closeCarModal() {
    const modal = document.getElementById('carSelectModal');
    if (modal) modal.classList.remove('visible');
  }

  showResultModal(rating, isSuccess) {
    const modal = document.getElementById('resultModal');
    if (!modal) return;

    const badge = document.getElementById('resultGradeBadge');
    const title = document.getElementById('resultTitle');
    const comment = document.getElementById('resultComment');
    const timeUsed = document.getElementById('resultTimeUsed');
    const cleanPercent = document.getElementById('resultCleanPercent');
    const starsContainer = document.getElementById('resultStars');

    if (badge) {
      badge.textContent = rating.grade;
      badge.className = `grade-badge grade-${rating.grade.toLowerCase()}`;
    }
    if (title) title.textContent = rating.title;
    if (comment) comment.textContent = rating.comment;
    if (timeUsed) timeUsed.textContent = `${rating.timeSpent} 秒`;
    if (cleanPercent) cleanPercent.textContent = `${rating.cleanliness.toFixed(1)}%`;

    if (starsContainer) {
      starsContainer.innerHTML = '⭐'.repeat(rating.stars) + '☆'.repeat(5 - rating.stars);
    }

    modal.classList.add('visible');
  }

  hideResultModal() {
    const modal = document.getElementById('resultModal');
    if (modal) modal.classList.remove('visible');
  }

  /**
   * 绘制自定义工具光标
   */
  drawToolCursor(ctx) {
    if (!this.cursorPos.visible || this.cursorPos.x < 0) return;

    ctx.save();
    const { x, y } = this.cursorPos;
    const tool = this.currentTool;

    // 工具有效范围作用圈
    ctx.strokeStyle = this.isInteracting ? 'rgba(56, 189, 248, 0.9)' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, tool.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 工具专属图标跟随
    ctx.setLineDash([]);
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tool.icon, x + 20, y - 20);

    ctx.restore();
  }

  /**
   * 主渲染与物理动画循环 (60+ FPS)
   */
  gameLoop() {
    const dt = 1 / 60;

    // 1. 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // 2. 绘制汽车车体、专属车型细节与高光车漆
    CarRenderer.render(this.ctx, this.currentCar, this.currentColor, this.carBounds);

    // 3. 绘制污渍层 (泥土、灰尘、番茄酱、大便/鸟粪) 及泡沫层
    this.dirtManager.draw(this.ctx);

    // 4. 更新并绘制粒子动画 (高压水花、泡沫雪崩、抛光金星、漂浮文字)
    this.particleSystem.update(dt);
    this.particleSystem.draw(this.ctx);

    // 5. 绘制工具准星
    this.drawToolCursor(this.ctx);

    requestAnimationFrame(() => this.gameLoop());
  }
}

// 页面加载就绪后初始化游戏
window.addEventListener('DOMContentLoaded', () => {
  window.carWashGame = new CarWashGame();
});
