import { makeRoomKey } from '../utils/helpers';

/** 퀘스트 투표 제한 시간 (5분) */
export const QUEST_TIMEOUT_MS = 5 * 60 * 1000;

const questTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 방별 퀘스트 투표 타이머를 설정한다.
 * 같은 방에 이미 타이머가 있으면 먼저 취소한다.
 */
export function setQuestTimer(
  guildId: string,
  channelId: string,
  callback: () => void,
  ms: number = QUEST_TIMEOUT_MS,
): void {
  clearQuestTimer(guildId, channelId);
  const key = makeRoomKey(guildId, channelId);
  questTimers.set(key, setTimeout(callback, ms));
}

/**
 * 방별 퀘스트 투표 타이머를 취소한다.
 */
export function clearQuestTimer(guildId: string, channelId: string): void {
  const key = makeRoomKey(guildId, channelId);
  const timer = questTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    questTimers.delete(key);
  }
}
