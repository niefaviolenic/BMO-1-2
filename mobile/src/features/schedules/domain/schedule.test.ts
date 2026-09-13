/* eslint-disable import/no-unresolved */
// @ts-ignore
import { describe, expect, it } from 'vitest';

vi.mock('@/lib/api', () => ({
  isApiError: vi.fn().mockReturnValue(false),
}));

import {
  filterScheduleCards,
  formatScheduleFooter,
  formatScheduleTime,
  scheduleCardTitle,
  type Schedule,
  type ScheduleCardItem,
} from './schedule';

const mockCards: ScheduleCardItem[] = [
  { id: '1', status: 'MONITORING', title: 'Daily water', description: 'Drink water' },
  { id: '2', status: 'WEEKLY', title: 'Weekly gym', description: 'Go to gym' },
  { id: '3', status: 'PAUSED', title: 'Paused task', description: 'Take vitamins' },
  { id: '4', status: 'COMPLETED', title: 'Done task', description: 'Read book' },
];

describe('Schedule Domain Helpers', () => {
  it('filters cards by All, Active, Paused, and Completed', () => {
    const all = filterScheduleCards(mockCards, 'All');
    expect(all).toHaveLength(4);

    const active = filterScheduleCards(mockCards, 'Active');
    expect(active).toHaveLength(2);
    expect(active.map((c) => c.id)).toEqual(['1', '2']);

    const paused = filterScheduleCards(mockCards, 'Paused');
    expect(paused).toHaveLength(1);
    expect(paused[0]?.id).toBe('3');

    const completed = filterScheduleCards(mockCards, 'Completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.id).toBe('4');
  });

  it('formats schedule exact time when provided', () => {
    const schedule: Schedule = {
      id: 'sch-1',
      status: 'ACTIVE',
      statusLabel: 'MONITORING',
      version: 1,
      payload: { prompt: 'Reminder', deliveryTargets: ['MOBILE'] },
      recurrence: { frequency: 'Daily', every: 1, timeOfDay: 'Morning', exactTime: '14:30' },
      nextRunAt: '2026-09-14T07:30:00.000Z',
      timezone: 'Asia/Jakarta',
    };

    expect(formatScheduleTime(schedule)).toBe('14:30 WIB');
  });

  it('formats schedule footer for Daily, Weekly, and Once', () => {
    const dailySchedule: Schedule = {
      id: 'sch-daily',
      status: 'ACTIVE',
      statusLabel: 'MONITORING',
      version: 1,
      payload: { prompt: 'Drink water', deliveryTargets: ['MOBILE'] },
      recurrence: { frequency: 'Daily', every: 1, timeOfDay: 'Morning', exactTime: '08:00' },
      nextRunAt: '2026-09-14T01:00:00.000Z',
      timezone: 'Asia/Jakarta',
    };
    expect(formatScheduleFooter(dailySchedule)).toBe('Daily · 08:00 WIB');

    const weeklySchedule: Schedule = {
      ...dailySchedule,
      statusLabel: 'WEEKLY',
      recurrence: {
        frequency: 'Weekly',
        every: 1,
        repeatDay: 'Monday',
        days: ['Monday', 'Thursday'],
        timeOfDay: 'Morning',
        exactTime: '09:00',
      },
    };
    expect(formatScheduleFooter(weeklySchedule)).toBe('Mondays, Thursdays · 09:00 WIB');
  });

  it('truncates schedule card title if longer than 48 characters', () => {
    const shortTitle = 'Drink water';
    expect(scheduleCardTitle(shortTitle)).toBe('Drink water');

    const longTitle = 'Recommend a few exciting things to do nearby this weekend in nature';
    expect(scheduleCardTitle(longTitle).endsWith('...')).toBe(true);
    expect(scheduleCardTitle(longTitle).length).toBeLessThanOrEqual(48);
  });
});
