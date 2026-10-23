import { type Block, type Category, makeId } from './model';

export const HALF_HOUR = 30;
export type TilePart = { block: Block; start: number; minutes: number };

/** Clips scheduled blocks to a visible half-hour. Works across midnight because offsets are 7AM-based. */
export function partsInHalfHour(blocks: Block[], slot: number): TilePart[] {
  const end = slot + HALF_HOUR;
  return blocks.filter(b => b.start < end && b.start + b.duration > slot)
    .map(block => {
      const start = Math.max(slot, block.start);
      return { block, start, minutes: Math.min(end, block.start + block.duration) - start };
    }).sort((a,b) => a.start - b.start);
}
export const tileSleepMinutes = (blocks: Block[], slot: number) =>
  partsInHalfHour(blocks, slot).filter(x => x.block.category === 'sleep').reduce((sum,x) => sum + x.minutes, 0);

/** Replace a bounded interval, preserving activities on either side and previous days untouched. */
export function replaceInterval(blocks: Block[], start: number, duration: number, category: Category, title: string, details = ''): Block[] {
  const end = start + duration;
  if(start < 0 || duration <= 0 || end > 1440) throw new Error('Activity must remain within the day.');
  const remaining: Block[] = [];
  for(const b of blocks) {
    const bEnd = b.start + b.duration;
    if(bEnd <= start || b.start >= end) { remaining.push(b); continue; }
    // Edited portions lose their measured-sleep flag; it's no longer the same nap.
    if(b.start < start) remaining.push({ ...b, id: makeId(), duration: start - b.start, actualSleep: b.category === 'sleep' ? null : b.actualSleep });
    if(bEnd > end) remaining.push({ ...b, id: makeId(), start: end, duration: bEnd - end, actualSleep: b.category === 'sleep' ? null : b.actualSleep });
  }
  remaining.push({ id: makeId(), start, duration, category, title, details, completed: false, actualSleep: null });
  return remaining.sort((a,b) => a.start - b.start);
}

/** Switching a partly-sleeping tile awake keeps the existing potty/meal/activity slices. */
export function wakeHalfHour(blocks: Block[], slot: number): Block[] {
  let result = blocks;
  // Reverse order doesn't matter; all intervals use absolute offsets.
  for(const part of partsInHalfHour(blocks, slot).filter(x => x.block.category === 'sleep')) {
    result = replaceInterval(result, part.start, part.minutes, 'other', 'Open activity time');
  }
  return result;
}

/** Turning a tile into sleep replaces any activities in the tile; caller must request confirmation. */
export function sleepHalfHour(blocks: Block[], slot: number): Block[] {
  return replaceInterval(blocks, slot, HALF_HOUR, 'sleep', 'Rest & recharge');
}
