/**
 * activity.ts 단위 테스트 — 무조작 방 자동 정리 (Auto-cancel)
 *
 * 테스트 시나리오:
 * 1) waiting 상태 → 10분 후 자동 종료
 * 2) 로비에서 join/leave 등 조작 → 타이머 리셋(10분 연장)
 * 3) finished 전환 → 3분 타이머 시작
 * 4) finished에서 rules 같은 커맨드 실행 → 3분 연장
 * 5) 진행 중 상태에서는 cleanup 타이머 미설정
 * 6) 타이머 중복 없이 항상 1개만 유지
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGameState, GameState, GamePhase } from '../game/GameState';
import { markActivity, ensureCleanupTimer } from '../game/activity';
import { LOBBY_CLEANUP_MS, FINISHED_CLEANUP_MS } from '../game/timerManager';

// ── gameManager mock ───────────────────────────────────────

const mockDeleteRoom = vi.fn();
const mockGetRoom    = vi.fn();

vi.mock('../game/gameManager', () => ({
  getRoom:    (...args: unknown[]) => mockGetRoom(...args),
  deleteRoom: (...args: unknown[]) => mockDeleteRoom(...args),
}));

// ── Discord Client mock ───────────────────────────────────

const mockSend  = vi.fn().mockResolvedValue(undefined);
const mockChannel = {
  isTextBased: () => true,
  type: 0, // GuildText (≠ GroupDM)
  send: mockSend,
};
const mockClient = {
  channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
} as unknown as import('discord.js').Client;

// ── 헬퍼 ─────────────────────────────────────────────────

function makeRoom(phase: GamePhase = 'waiting'): GameState {
  const room = createGameState('g1', 'c1', 'host');
  room.phase = phase;
  room.players.push({ id: 'host', username: 'Host' });
  return room;
}

// ─────────────────────────────────────────────────────────

describe('타임아웃 상수', () => {
  it('LOBBY_CLEANUP_MS = 10분', () => {
    expect(LOBBY_CLEANUP_MS).toBe(10 * 60 * 1000);
  });
  it('FINISHED_CLEANUP_MS = 3분', () => {
    expect(FINISHED_CLEANUP_MS).toBe(3 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────

describe('ensureCleanupTimer — 타이머 설정 규칙', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDeleteRoom.mockReset();
    mockGetRoom.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 시나리오 1: waiting → 10분 후 자동 종료
  it('waiting: 10분 경과 후 deleteRoom 호출', () => {
    const room = makeRoom('waiting');
    mockGetRoom.mockReturnValue(room);

    ensureCleanupTimer(room, mockClient);
    expect(room.cleanupTimer).not.toBeNull();

    vi.advanceTimersByTime(LOBBY_CLEANUP_MS);
    expect(mockDeleteRoom).toHaveBeenCalledWith('g1', 'c1');
  });

  // 시나리오 3: finished → 3분 타이머
  it('finished: 3분 경과 후 deleteRoom 호출', () => {
    const room = makeRoom('finished');
    mockGetRoom.mockReturnValue(room);

    ensureCleanupTimer(room, mockClient);
    expect(room.cleanupTimer).not.toBeNull();

    vi.advanceTimersByTime(FINISHED_CLEANUP_MS);
    expect(mockDeleteRoom).toHaveBeenCalledWith('g1', 'c1');
  });

  // 시나리오 5: 진행 중 상태 → 타이머 없음
  it.each<GamePhase>(['proposal', 'team_vote', 'quest_vote', 'assassination'])(
    '%s 상태에서는 cleanupTimer를 설정하지 않는다',
    (phase) => {
      const room = makeRoom(phase);
      ensureCleanupTimer(room, mockClient);
      expect(room.cleanupTimer).toBeNull();
    },
  );

  // 시나리오 6: 타이머 중복 없음 — 항상 1개만 유지
  it('여러 번 호출해도 타이머는 1개만 유지된다 (중복 없음)', () => {
    const room = makeRoom('waiting');
    mockGetRoom.mockReturnValue(room);

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    // 두 번 설정: 두 번째가 첫 번째를 대체해야 함
    ensureCleanupTimer(room, mockClient);
    const firstHandle = room.cleanupTimer;

    ensureCleanupTimer(room, mockClient);
    const secondHandle = room.cleanupTimer;

    // 핸들이 교체됨
    expect(secondHandle).not.toBe(firstHandle);

    // 10분 경과: deleteRoom은 1번만 호출
    vi.advanceTimersByTime(LOBBY_CLEANUP_MS);
    expect(mockDeleteRoom).toHaveBeenCalledTimes(1);
  });

  // 시나리오 6 (추가): 진행 중으로 전환 시 기존 타이머 제거
  it('진행 중 phase로 전환하면 기존 cleanup 타이머가 제거된다', () => {
    const room = makeRoom('waiting');
    mockGetRoom.mockReturnValue(room);

    ensureCleanupTimer(room, mockClient); // 10분 타이머 설정
    expect(room.cleanupTimer).not.toBeNull();

    room.phase = 'proposal';
    ensureCleanupTimer(room, mockClient); // 진행 중 → 타이머 제거
    expect(room.cleanupTimer).toBeNull();

    vi.advanceTimersByTime(LOBBY_CLEANUP_MS * 2);
    expect(mockDeleteRoom).not.toHaveBeenCalled(); // 타이머가 취소됨
  });
});

// ─────────────────────────────────────────────────────────

describe('markActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDeleteRoom.mockReset();
    mockGetRoom.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 시나리오 2: 로비에서 조작 → 타이머 리셋 (10분 연장)
  it('waiting: 8분 후 markActivity → 타이머가 10분 연장됨', () => {
    const room = makeRoom('waiting');
    mockGetRoom.mockReturnValue(room);

    ensureCleanupTimer(room, mockClient); // 최초 10분 타이머

    vi.advanceTimersByTime(8 * 60 * 1000); // 8분 경과
    expect(mockDeleteRoom).not.toHaveBeenCalled();

    markActivity(room, mockClient); // 조작 → 타이머 리셋

    vi.advanceTimersByTime(9 * 60 * 1000); // 추가 9분 (리셋 후 9분, 아직 10분 미만)
    expect(mockDeleteRoom).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1 * 60 * 1000); // 추가 1분 (리셋 후 정확히 10분)
    expect(mockDeleteRoom).toHaveBeenCalledTimes(1);
  });

  it('lastActivityAt을 현재 시각으로 갱신한다', () => {
    const room = makeRoom('waiting');
    const before = room.lastActivityAt;

    vi.advanceTimersByTime(5000);
    markActivity(room, mockClient);

    expect(room.lastActivityAt).toBeGreaterThan(before);
  });

  // 시나리오 4: finished에서 커맨드 실행 → 3분 연장
  it('finished: 2분 후 markActivity → 3분 연장됨', () => {
    const room = makeRoom('finished');
    mockGetRoom.mockReturnValue(room);

    ensureCleanupTimer(room, mockClient); // 최초 3분 타이머

    vi.advanceTimersByTime(2 * 60 * 1000); // 2분 경과
    expect(mockDeleteRoom).not.toHaveBeenCalled();

    markActivity(room, mockClient); // 조작 → 3분 리셋

    vi.advanceTimersByTime(2 * 60 * 1000 + 59 * 1000); // 2분 59초 추가
    expect(mockDeleteRoom).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000); // 마지막 1초 → 총 3분 경과
    expect(mockDeleteRoom).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────

describe('auto-cancel 콜백 안전 조건', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDeleteRoom.mockReset();
    mockGetRoom.mockReset();
    mockSend.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('타이머 발화 전 방이 수동 삭제되면 deleteRoom 미호출', async () => {
    const room = makeRoom('waiting');
    mockGetRoom.mockReturnValue(null); // 이미 삭제됨

    ensureCleanupTimer(room, mockClient);
    await vi.runAllTimersAsync();

    expect(mockDeleteRoom).not.toHaveBeenCalled();
  });

  it('타이머 발화 전 phase가 진행 중으로 바뀌면 deleteRoom 미호출', async () => {
    const room = makeRoom('waiting');
    // getRoom 반환 시 이미 proposal 상태
    const changedRoom = { ...room, phase: 'proposal' as GamePhase };
    mockGetRoom.mockReturnValue(changedRoom);

    ensureCleanupTimer(room, mockClient);
    await vi.runAllTimersAsync();

    expect(mockDeleteRoom).not.toHaveBeenCalled();
  });

  it('자동 종료 시 채널에 안내 메시지를 전송한다', async () => {
    const room = makeRoom('waiting');
    mockGetRoom.mockReturnValue(room);

    ensureCleanupTimer(room, mockClient);
    await vi.runAllTimersAsync();

    expect(mockSend).toHaveBeenCalledWith(
      expect.stringContaining('활동이 없어 방을 자동으로 종료'),
    );
  });
});
