/**
 * Car Wash Game - Adaptive Car Registry & Configuration
 * 自动扫描并解析 assets/cars/ (或 cars/) 目录中的图片文件
 * 文件命名规范: 车辆品牌_车辆型号_颜色.jpg (或 .png, .jpeg, .webp)
 */

const CarRegistry = {
  cars: [],

  register(carConfig) {
    if (!carConfig.id || !carConfig.name) return;
    const existingIndex = this.cars.findIndex(c => c.id === carConfig.id);
    if (existingIndex >= 0) {
      this.cars[existingIndex] = carConfig;
    } else {
      this.cars.push(carConfig);
    }
  },

  getCar(id) {
    return this.cars.find(c => c.id === id) || this.cars[0];
  },

  getAllCars() {
    return this.cars;
  },

  /**
   * 颜色名称智能映射十六进制色标
   */
  resolveColorHex(colorName) {
    const map = {
      '海湾蓝': '#1d89b4',
      '霞光紫': '#6d426e',
      '熔岩橙': '#de541e',
      '紫色': '#703080',
      '深紫': '#4a2558',
      '黑色': '#18191c',
      '白色': '#f8fafc',
      '红色': '#d9141e',
      '黄色': '#ffd000',
      '蓝色': '#2152a3',
      '金属色': '#b0b7bd',
      '银色': '#a6adb5',
      '灰色': '#6d757d',
      '绿色': '#1c5443',
      '金色': '#988365',
      '哑光黑': '#232427'
    };
    if (map[colorName]) return map[colorName];
    if (colorName.includes('蓝')) return '#1d89b4';
    if (colorName.includes('紫')) return '#6d426e';
    if (colorName.includes('橙')) return '#de541e';
    if (colorName.includes('红')) return '#d9141e';
    if (colorName.includes('黄')) return '#ffd000';
    if (colorName.includes('黑')) return '#18191c';
    if (colorName.includes('白')) return '#f8fafc';
    if (colorName.includes('银') || colorName.includes('金')) return '#b0b7bd';
    if (colorName.includes('绿')) return '#1c5443';
    return '#64748b';
  },

  /**
   * 根据文件名清单自动解析组装车辆与颜色选项
   */
  parseAndBuildCars(fileList) {
    const carMap = new Map();

    fileList.forEach(filename => {
      // 过滤非图片文件或隐藏文件
      if (filename.startsWith('.') || !filename.includes('_')) return;
      const cleanName = filename.substring(0, filename.lastIndexOf('.'));
      const parts = cleanName.split('_');
      if (parts.length < 2) return;

      const brand = parts[0].trim();
      const colorName = parts[parts.length - 1].trim();
      const model = parts.slice(1, parts.length - 1).join(' ').trim() || parts[1].trim();
      const carKey = `${brand}_${model}`;

      if (!carMap.has(carKey)) {
        carMap.set(carKey, {
          id: carKey.toLowerCase().replace(/[^a-z0-9_\u4e00-\u9fa5]/gi, '_'),
          name: `${brand} ${model}`,
          brand: brand,
          model: model,
          badge: this.guessBadge(brand, model),
          description: `${brand}旗下代表作 ${model}，支持多款个性化官方车漆精细清洗。`,
          colors: [],
          imageUrl: `assets/cars/${filename}`
        });
      }

      const car = carMap.get(carKey);
      // 添加该车型的专属配色
      car.colors.push({
        id: `${car.id}_${colorName}`,
        name: colorName,
        hex: this.resolveColorHex(colorName),
        imageUrl: `assets/cars/${filename}`
      });
    });

    this.cars = Array.from(carMap.values());
  },

  guessBadge(brand, model) {
    const lower = `${brand} ${model}`.toLowerCase();
    if (lower.includes('su7')) return '爆款轿跑';
    if (lower.includes('cyber')) return '赛博皮卡';
    if (lower.includes('488') || lower.includes('法拉利')) return '跃马超跑';
    if (lower.includes('威龙') || lower.includes('布加迪')) return '千匹神兽';
    if (lower.includes('大g') || lower.includes('g63')) return '硬派越野';
    if (lower.includes('库里南')) return '顶级奢华';
    if (lower.includes('model y')) return '全球销冠';
    if (lower.includes('es8')) return '智能旗舰';
    return '经典名车';
  },

  /**
   * 初始化自适应车辆清单
   */
  async initAdaptiveCars() {
    let files = window.CARS_FILE_LIST || [];

    // 若在本地 HTTP 服务器下运行，尝试即时探查 assets/cars 目录变动
    if (window.location.protocol.startsWith('http')) {
      try {
        const resp = await fetch('assets/cars/');
        if (resp.ok) {
          const text = await resp.text();
          const matches = text.match(/href="([^"]+\.(?:jpg|jpeg|png|webp))"/gi);
          if (matches && matches.length > 0) {
            const fetched = matches.map(m => decodeURIComponent(m.replace(/href="|"/g, '').split('/').pop()));
            files = Array.from(new Set([...files, ...fetched]));
          }
        }
      } catch (e) {
        // 使用静态清单
      }
    }

    this.parseAndBuildCars(files);
  }
};

// 预先使用静态文件清单进行同步解析，保证首帧即刻可用
if (window.CARS_FILE_LIST && window.CARS_FILE_LIST.length > 0) {
  CarRegistry.parseAndBuildCars(window.CARS_FILE_LIST);
}

/**
 * 脏污类型配置
 */
const DIRT_TYPES = {
  MUD: {
    id: 'mud',
    name: '泥土脏',
    icon: '🟤',
    color: '#5a3d28',
    texture: 'clumpy',
    baseHealth: 1.0,
    weakness: {
      water: 1.6,
      foam: 1.1,
      cloth: 0.5
    }
  },
  DUST: {
    id: 'dust',
    name: '灰尘脏',
    icon: '🌫️',
    color: '#8b8579',
    texture: 'hazy',
    baseHealth: 0.6,
    weakness: {
      water: 1.2,
      foam: 1.0,
      cloth: 1.8
    }
  },
  KETCHUP: {
    id: 'ketchup',
    name: '番茄酱脏',
    icon: '🥫',
    color: '#b81414',
    texture: 'sticky',
    baseHealth: 1.4,
    weakness: {
      foam: 1.8,
      water: 1.1,
      cloth: 0.9
    }
  },
  POOP: {
    id: 'poop',
    name: '大便/鸟粪脏',
    icon: '💩',
    color: '#443425',
    texture: 'splat',
    baseHealth: 1.8,
    weakness: {
      foam: 2.0,
      water: 1.4,
      cloth: 0.4
    }
  }
};

/**
 * 脏污程度难度等级
 */
const DIRT_LEVELS = {
  light: {
    id: 'light',
    name: '轻微脏',
    description: '日常轻微积灰与零星泥点，清洗轻松快速',
    spotCountRange: [10, 16],
    spotSizeScale: 0.8,
    healthMultiplier: 1.0,
    targetScoreBonus: 0
  },
  medium: {
    id: 'medium',
    name: '一般脏',
    description: '雨后泥水飞溅、灰尘与局部污点，需适度冲洗',
    spotCountRange: [18, 26],
    spotSizeScale: 1.0,
    healthMultiplier: 1.5,
    targetScoreBonus: 100
  },
  heavy: {
    id: 'heavy',
    name: '很脏',
    description: '长期未洗、厚重泥巴、顽固鸟粪与番茄酱，需多道工序清洗！',
    spotCountRange: [28, 38],
    spotSizeScale: 1.2,
    healthMultiplier: 2.4,
    targetScoreBonus: 300
  }
};

/**
 * 清洗工具配置
 */
const TOOLS = {
  FOAM: {
    id: 'foam',
    name: '喷清洗剂',
    enName: 'Snow Foam',
    icon: '🫧',
    actionSound: 'foam',
    cursor: 'crosshair',
    radius: 38,
    foamDepositRate: 0.8,
    cleanPower: 0.35,
    desc: '喷洒高密度雪崩泡沫，软化全车顽固污渍与泥垢'
  },
  WATER: {
    id: 'water',
    name: '高压水枪',
    enName: 'Power Washer',
    icon: '🔫',
    actionSound: 'water',
    cursor: 'crosshair',
    radius: 30,
    foamDepositRate: 0,
    cleanPower: 1.3,
    desc: '强劲高压水束，强力冲刷厚泥、番茄酱与泡沫'
  },
  CLOTH: {
    id: 'cloth',
    name: '人工用布擦',
    enName: 'Microfiber Towel',
    icon: '🧽',
    actionSound: 'cloth',
    cursor: 'grab',
    radius: 34,
    foamDepositRate: 0,
    cleanPower: 1.0,
    desc: '超细纤维洗车布手工擦拭，抹除细微浮尘，闪亮抛光'
  }
};

const GAME_CONFIG = {
  MAX_TIME_SECONDS: 180,
  WARNING_TIME_SECONDS: 30,
  CLEAN_WIN_THRESHOLD: 99.5
};
