import { makeRoomKey } from '../utils/helpers';
import { GameState } from './GameState';

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

// ── Cleanup Timer (무조작 방 자동 정리) ────────────────────
// quest timer와 달리 타이머 핸들을 GameState 필드에 직접 저장한다.
// (guildId/channelId 없이도 room 객체만 있으면 조작 가능)

/** 로비(waiting) 무조작 자동 정리 타임아웃: 10분 */
export const LOBBY_CLEANUP_MS = 10 * 60 * 1000;

/** 종료(finished) 후 무조작 자동 정리 타임아웃: 3분 */
export const FINISHED_CLEANUP_MS = 3 * 60 * 1000;

/**
 * 방의 정리 타이머를 취소한다.
 * room.cleanupTimer가 null이면 아무 작업도 하지 않는다.
 */
export function clearCleanupTimer(room: GameState): void {
  if (room.cleanupTimer !== null) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}
