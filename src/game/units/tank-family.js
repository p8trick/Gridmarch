// 坦克家族：三款车型都用"行进 + 开火动画"的性能版（轻坦 V1.5 动画版 / 中坦 V3.2 / 重坦 V1.2）。
// 目录各自完整（三款的 tank.js、track-path.js 等同名但内容不同，所以分目录存放）。
import {createTank as createLightTank} from '../../art/units/tank-light/tank.js';
import {createTank as createMediumTank} from '../../art/units/tank-medium/tank-performance.js';
import {createTank as createHeavyTank} from '../../art/units/tank-heavy/tank-performance.js';

export {createLightTank, createMediumTank, createHeavyTank};
export const tankFactories = Object.freeze({light:createLightTank, medium:createMediumTank, heavy:createHeavyTank});
export const tankVersions = Object.freeze({light:'1.5 动画性能版', medium:'3.2 性能版', heavy:'1.2 性能版'});
// 左右履带中心距（模型自身单位），差速转向用：左右各走 ±(转角 × 中心距 / 2)
export const TRACK_GAUGE = Object.freeze({light:1.76, medium:2.15, heavy:2.67});

export function createTank(type, options={}) {
  const factory=tankFactories[type];
  if(!factory) throw new RangeError(`Unknown tank type: ${type}`);
  return factory(options);
}

export function setAimRadians(model, yawRad=0, elevationRad=0) {
  model.setAim(yawRad*180/Math.PI, elevationRad*180/Math.PI);
}
