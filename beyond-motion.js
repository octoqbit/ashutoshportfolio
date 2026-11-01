import { clamp, range } from './motion.js';

export const BEYOND_EXTRA_SCREENS = 2.8;
const START = .84;

// Extra scroll belongs entirely after the existing tunnel has finished.
export function journeyProgress(offset, travel, viewport) {
  const original = Math.max(1, travel - BEYOND_EXTRA_SCREENS * viewport);
  const boundary = original * START;
  return clamp(offset <= boundary ? offset / original : START + (offset - boundary) / (travel - boundary) * (1 - START));
}
export function journeyOffset(progress, travel, viewport) {
  const p = clamp(progress), original = Math.max(1, travel - BEYOND_EXTRA_SCREENS * viewport);
  const boundary = original * START;
  return p <= START ? p * original : boundary + (p - START) / (1 - START) * (travel - boundary);
}

export function beyondState(progress) {
  const p = clamp((progress - START) / (1 - START));
  const walk = range(p, 0, .48), revolve = range(p, .38, .70), enter = range(p, .70, .94);
  return {
    progress: p, walk, revolve, enter,
    x: 1.8 * (1 - walk),
    y: 2.55 + enter * .2,
    z: 20 - 29 * walk - 3 * range(p, .48, .70) - 7.7 * enter,
    rotation: -.28 * (1 - revolve) + Math.PI * 2 * revolve,
    gold: range(p, .82, .94),
    copy: 1 - range(p, .08, .28),
    reveal: range(p, .96, 1),
  };
}
