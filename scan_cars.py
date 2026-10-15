#!/usr/bin/env python3
"""
自动扫描 assets/cars 目录下的车辆图片，生成 js/carsManifest.js
命名规范: 车辆品牌_车辆型号_颜色.jpg (或 .png, .jpeg, .webp)
"""

import os
import json

CARS_DIR = 'assets/cars'
OUTPUT_FILE = 'js/carsManifest.js'

def scan():
    if not os.path.exists(CARS_DIR):
        print(f"Directory {CARS_DIR} does not exist.")
        return

    valid_exts = ('.jpg', '.jpeg', '.png', '.webp')
    files = []
    
    for fname in sorted(os.listdir(CARS_DIR)):
        if fname.startswith('.') or fname == '.DS_Store':
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext in valid_exts and '_' in fname:
            files.append(fname)

    js_content = f"""/**
 * 自动生成的车辆图片清单
 * 来源目录: assets/cars
 * 命名规范: 车辆品牌_车辆型号_颜色.jpg / .png
 */
window.CARS_FILE_LIST = {json.dumps(files, ensure_ascii=False, indent=2)};
"""

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"Successfully scanned {len(files)} car images into {OUTPUT_FILE}")

if __name__ == '__main__':
    scan()
