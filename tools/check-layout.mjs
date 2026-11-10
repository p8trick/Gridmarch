// 布局校验：建筑/树林/山/路/单位必须落在平原上且互不重叠；单位不能进海，只有步兵能进河（失败会抛错并列出每一处）
import {PRESETS,validateLayout} from '../src/game/map-builder.js';
import '../src/game/levels/index.js';   // 关卡预设也纳入检查
let bad=0;
for(const [k,P] of Object.entries(PRESETS)){try{validateLayout(P);console.log('PASS',k,P.name)}catch(e){bad++;console.log('FAIL',k,e.message)}}
process.exit(bad?1:0);
