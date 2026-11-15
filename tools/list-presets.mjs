// 打印全部预设地图名（给 check-all 用；需要带加载器运行）
import {PRESETS} from '../src/game/map-builder.js';
import '../src/game/levels/index.js';   // 关卡预设也纳入检查
console.log(Object.keys(PRESETS).join('\n'));
