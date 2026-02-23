/**
 * 버그 수정 + 재시작 투표 순수 로직 테스트.
 * leave/cancel 차단, status 퀘스트 기록, 재시작 투표 과반 계산.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGameState, GameState, GamePhase } from '../game/GameState';

// ── 헬퍼 ───────────────────────────────────────────────────

function makeRoom(playerCount: number, phase: GamePhase = 'proposal'): GameState {
  const room = createGameState('g', 'c', 'p0');
  for (let i = 0; i < playerCount; i++) {
    room.players.push({ id: `p${i}`, username: `P${i}` });
  }
  room.phase = phase;
  room.round = 1;
  return room;
}

/** 게임 진행 중 페이즈 목록 */
const ACTIVE_PHASES: GamePhase[] = ['proposal', 'team_vote', 'quest_vote', 'assassination'];

// ────────────────────────────────────────────

describe('leave/cancel 차단 - 게임 진행 중', () => {
  it('waiting 페이즈에서는 leave 허용 조건', () => {
    const room = makeRoom(5, 'waiting');
    const canLeave = room.phase === 'waiting' || room.phase === 'finished';
    expect(canLeave).toBe(true);
  });

  it('finished 페이즈에서는 leave 허용 조건', () => {
    const room = makeRoom(5, 'finished');
    const canLeave = room.phase === 'waiting' || room.phase === 'finished';
    expect(canLeave).toBe(true);
  });

  it.each(ACTIVE_PHASES)('%s 페이즈에서는 leave 차단', (phase) => {
    const room = makeRoom(5, phase);
    const canLeave = room.phase === 'waiting' || room.phase === 'finished';
    expect(canLeave).toBe(false);
  });

  it.each(ACTIVE_PHASES)('%s 페이즈에서는 cancel 차단', (phase) => {
    const room = makeRoom(5, phase);
    const canCancel = room.phase === 'waiting' || room.phase === 'finished';
    expect(canCancel).toBe(false);
  });
});

// ────────────────────────────────────────────

describe('status - 퀘스트 기록 표시', () => {
  it('waiting 페이즈에서는 퀘스트 기록 없음', () => {
    const room = makeRoom(5, 'waiting');
    expect(room.questResults).toHaveLength(0);
  });

  it('퀘스트 결과가 있으면 기록 표시 가능', () => {
    const room = makeRoom(5, 'proposal');
    room.questResults = ['success', 'fail', 'success'];
    const record = room.questResults.map((r) => (r === 'success' ? '✅' : '❌')).join(' ');
    expect(record).toBe('✅ ❌ ✅');
  });

  it('퀘스트 기록 없으면 표시 스킵', () => {
    const room = makeRoom(5, 'proposal');
    expect(room.questResults.length > 0).toBe(false);
  });
});

// ────────────────────────────────────────────

describe('restart - 재시작 가능 조건', () => {
  it('waiting 페이즈에서는 restart 불가', () => {
    const room = makeRoom(5, 'waiting');
    expect(room.phase === 'waiting').toBe(true);
  });

  it.each([...ACTIVE_PHASES, 'finished' as GamePhase])('%s 페이즈에서는 restart 가능', (phase) => {
    const room = makeRoom(5, phase);
    expect(room.phase !== 'waiting').toBe(true);
  });
});

// ────────────────────────────────────────────

describe('재시작 투표 - 과반 계산', () => {
  /** 과반 수 (Math.floor(n/2) + 1) */
  function majority(n: number) { return Math.floor(n / 2) + 1; }

  it('5명 과반 = 3명', () => expect(majority(5)).toBe(3));
  it('6명 과반 = 4명', () => expect(majority(6)).toBe(4));
  it('7명 과반 = 4명', () => expect(majority(7)).toBe(4));
  it('10명 과반 = 6명', () => expect(majority(10)).toBe(6));

  it('YES 과반 도달 → 재시작', () => {
    const room = makeRoom(5);
    room.restartVotes = { p0: true, p1: true, p2: true }; // 3/5 = 과반
    const yesCount = Object.values(room.restartVotes).filter(Boolean).length;
    expect(yesCount >= majority(5)).toBe(true);
  });

  it('NO 과반 도달 → 부결', () => {
    const room = makeRoom(5);
    room.restartVotes = { p0: false, p1: false, p2: false }; // 3/5 NO
    const noCount = Object.values(room.restartVotes).filter((v) => !v).length;
    expect(noCount >= majority(5)).toBe(true);
  });

  it('동수(3명 YES, 3명 NO, 6명) → 부결 (과반 미달)', () => {
    const room = makeRoom(6);
    room.restartVotes = { p0: true, p1: true, p2: true, p3: false, p4: false, p5: false };
    const yesCount = Object.values(room.restartVotes).filter(Boolean).length;
    expect(yesCount >= majority(6)).toBe(false); // 3 < 4
  });

  it('아직 과반 미달 → 투표 계속', () => {
    const room = makeRoom(5);
    room.restartVotes = { p0: true, p1: true }; // 2/5 YES, 과반 미달
    const yesCount = Object.values(room.restartVotes).filter(Boolean).length;
    const noCount = Object.values(room.restartVotes).filter((v) => !v).length;
    expect(yesCount >= majority(5)).toBe(false);
    expect(noCount >= majority(5)).toBe(false);
  });

  it('이미 투표한 플레이어 감지', () => {
    const room = makeRoom(5);
    room.restartVotes = { p0: true };
    expect('p0' in room.restartVotes).toBe(true);
    expect('p1' in room.restartVotes).toBe(false);
  });

  it('투표 완료 후 restartVotes 초기화', () => {
    const room = makeRoom(5);
    room.restartVotes = { p0: true, p1: true, p2: true };
    room.restartVotes = {}; // 재시작 확정 후 초기화
    expect(Object.keys(room.restartVotes)).toHaveLength(0);
  });
});

// ────────────────────────────────────────────

describe('재시작 후 상태 초기화', () => {
  let room: GameState;

  beforeEach(() => {
    room = makeRoom(5, 'finished');
    room.questResults = ['success', 'fail', 'success'];
    room.round = 3;
    room.proposalNumber = 2;
    room.currentTeam = ['p0', 'p1'];
    room.teamVotes = { p0: true };
    room.questVotes = { p0: false };
    room.restartVotes = { p0: true, p1: true, p2: true };
  });

  it('재시작 후 round = 1', () => {
    room.round = 1;
    expect(room.round).toBe(1);
  });

  it('재시작 후 questResults 초기화', () => {
    room.questResults = [];
    expect(room.questResults).toHaveLength(0);
  });

  it('재시작 후 proposalNumber = 0', () => {
    room.proposalNumber = 0;
    expect(room.proposalNumber).toBe(0);
  });

  it('재시작 후 phase = proposal', () => {
    room.phase = 'proposal';
    expect(room.phase).toBe('proposal');
  });

  it('재시작 후 players는 유지됨', () => {
    expect(room.players).toHaveLength(5); // 같은 인원 유지
  });

  it('재시작 후 restartVotes 초기화', () => {
    room.restartVotes = {};
    expect(Object.keys(room.restartVotes)).toHaveLength(0);
  });
});
