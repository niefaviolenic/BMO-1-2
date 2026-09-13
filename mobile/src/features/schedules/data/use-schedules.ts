import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  filterScheduleCards,
  getContextMenuVariant,
  toScheduleCardItem,
  type Schedule,
  type ScheduleCardItem,
  type ScheduleStatusFilter,
} from '../domain/schedule';
import type { CreateScheduleInput, UpdateScheduleBody } from './schedule-api';
import {
  addNewSchedule,
  createScheduleFromPrompt,
  deleteScheduleById,
  getScheduleStoreState,
  pauseScheduleById,
  refreshSchedules,
  resumeScheduleById,
  subscribeSchedules,
  updateScheduleById,
} from './schedule-store';
export function useSchedules(filter: ScheduleStatusFilter) {
  const snapshot = useSyncExternalStore(
    subscribeSchedules,
    getScheduleStoreState,
    getScheduleStoreState,
  );

  const cards = useMemo(() => {
    return snapshot.schedules
      .filter((schedule) => schedule.status !== 'CANCELLED')
      .map((schedule) => toScheduleCardItem(schedule));
  }, [snapshot.schedules]);

  const visibleCards = useMemo(
    () => filterScheduleCards(cards, filter),
    [cards, filter],
  );

  const hasSchedules = cards.length > 0;

  const load = useCallback(async () => {
    await refreshSchedules();
  }, []);

  const createFromPrompt = useCallback(async (prompt: string) => {
    await createScheduleFromPrompt(prompt);
  }, []);

  const create = useCallback(
    async (input: CreateScheduleInput) => {
      await addNewSchedule(input);
    },
    [],
  );

  const pause = useCallback(async (id: string) => {
    await pauseScheduleById(id);
  }, []);

  const resume = useCallback(async (id: string) => {
    await resumeScheduleById(id);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteScheduleById(id);
  }, []);
  const update = useCallback(
    async (id: string, patch: Omit<UpdateScheduleBody, 'version'>) => {
      await updateScheduleById(id, patch);
    },
    [],
  );

  const rawScheduleById = useCallback(
    (id: string | null): Schedule | null => {
      if (!id) return null;
      return snapshot.schedules.find((item) => item.id === id) ?? null;
    },
    [snapshot.schedules],
  );


  const cardById = useCallback(
    (id: string | null): ScheduleCardItem | null => {
      if (!id) {
        return null;
      }
      return cards.find((item) => item.id === id) ?? null;
    },
    [cards],
  );

  return {
    create,
    cards: visibleCards,
    hasSchedules,
    scheduleCount: snapshot.schedules.length,
    isLoading: snapshot.isLoading,
    isMutating: snapshot.isMutating,
    load,
    createFromPrompt,
    pause,
    resume,
    remove,
    cardById,
    update,
    rawScheduleById,
    getContextMenuVariant,
  };
}
