// 关卡注册：把关卡预设放进 PRESETS，这样 npm test（布局校验 / 水域接缝）自动覆盖。游戏页直接用 makeLevel1(seed)。
import {PRESETS} from '../map-builder.js';
import {makeLevel1} from './level1.js';
PRESETS.level1 = makeLevel1(1);
export {makeLevel1};
