/**
 * 무조작 방 자동 정리 (Auto-cancel) 로직
 *
 * 정책:
 *   - waiting  (로비)  : 10분 무조작 시 자동 삭제
 *   - finished (종료)  : 3분  무조작 시 자동 삭제
 *   - 그 외 (진행 중) : 정리 타이머 없음
 *
 * "조작(activity)" 정의:
 *   - Slash command 실행
 *   - Button interaction
 *   - SelectMenu interaction
 *   봇이 자체적으로 상태를 전환하는 것은 activity로 취급하지 않는다.
 *
 * 호출 지점:
 *   - router.ts : 모든 interaction 처리 후 tryMarkActivity() 가 호출됨
 *   - buttonHandlers.ts : bot-triggered 상태 전환(quest 타임아웃 등) 후
 *                         ensureCleanupTimer() 를 직접 호출
 */

import { ChannelType, Client } from 'discord.js';
import { GameState } from './GameState';
import { getRoom, deleteRoom } from './gameManager';
import { clearCleanupTimer, LOBBY_CLEANUP_MS, FINISHED_CLEANUP_MS } from './timerManager';

const AUTO_CANCEL_MSG =
  '🧹 일정 시간 동안 활동이 없어 방을 자동으로 종료했어요. 다시 하려면 `/avalon create`';

/**
 * 현재 phase에 맞는 정리 타이머를 1개만 유지한다.
 *
 * - waiting  → LOBBY_CLEANUP_MS(10분) 후 auto-cancel
 * - finished → FINISHED_CLEANUP_MS(3분) 후 auto-cancel
 * - 그 외    → 기존 타이머만 제거 (게임 진행 중이므로 자동 정리 없음)
 *
 * 기존 타이머가 있으면 먼저 제거한 뒤 새로 설정하므로 중복 타이머가 생기지 않는다.
 */
export function ensureCleanupTimer(room: GameState, client: Client): void {
  clearCleanupTimer(room); // 항상 기존 타이머 먼저 제거

  const { guildId, channelId, phase } = room;

  let delayMs: number;
  if (phase === 'waiting') {
    delayMs = LOBBY_CLEANUP_MS;
  } else if (phase === 'finished') {
    delayMs = FINISHED_CLEANUP_MS;
  } else {
    return; // 진행 중: 자동 정리 타이머 없음
  }

  room.cleanupTimer = setTimeout(async () => {
    // 타이머 발화 시점에 방이 이미 삭제되었거나 phase가 바뀌었으면 취소
    const current = getRoom(guildId, channelId);
    if (!current) return;
    if (current.phase !== 'waiting' && current.phase !== 'finished') return;

    deleteRoom(guildId, channelId);

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel?.isTextBased() && channel.type !== ChannelType.GroupDM) {
        await channel.send(AUTO_CANCEL_MSG);
      }
    } catch {
      // 채널 조회 실패는 무시 (메시지 전송 실패가 방 삭제를 막으면 안 됨)
    }
  }, delayMs);
}

/**
 * 사용자 조작 발생 시 호출한다.
 *
 * 1) lastActivityAt 갱신
 * 2) 현재 phase 기준으로 정리 타이머 재설정 (타이머 리셋)
 */
export function markActivity(room: GameState, client: Client): void {
  room.lastActivityAt = Date.now();
  ensureCleanupTimer(room, client);
}
