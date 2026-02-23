/**
 * Phase 5 상태 전이 테스트: Discord 없이 순수 게임 로직만 검증.
 * 퀘스트 투표 집계, 라운드 전환, 역할별 권한, 전체 게임 시나리오.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGameState, GameState } from '../game/GameState';
import { isQuestFailed, checkWinCondition } from '../game/questConfig';
import { ROLE_INFO, RoleName, assignRoles } from '../game/roles';

// ── 테스트 헬퍼 ────────────────────────────────────────────

/**
 * resolveQuest의 순수 상태 변경 로직만 추출. Discord 호출 없음.
 */
function simulateQuestResolution(room: GameState, failCount: number) {
  const questFailed = isQuestFailed(failCount, room.players.length, room.round);
  room.questResults.push(questFailed ? 'fail' : 'success');
  const winState = checkWinCondition(room.questResults);

  if (winState === 'evil_wins') {
    room.phase = 'finished';
  } else if (winState === 'good_wins_assassination') {
    room.phase = 'assassination';
  } else {
    room.leaderIndex = (room.leaderIndex + 1) % room.players.length;
    room.round++;
    room.proposalNumber = 0;
    room.currentTeam = [];
    room.questVotes = {};
    room.teamVotes = {};
    room.phase = 'proposal';
  }

  return { winState, questFailed };
}

/** n명 플레이어가 있는 게임 방을 생성한다. */
function makeRoom(playerCount: number): GameState {
  const room = createGameState('guild-1', 'ch-1', 'p0');
  for (let i = 0; i < playerCount; i++) {
    room.players.push({ id: `p${i}`, username: `P${i}` });
  }
  room.phase = 'quest_vote';
  room.round = 1;
  room.leaderIndex = 0;
  return room;
}

// ────────────────────────────────────────────

describe('퀘스트 투표 집계 (questVotes Record)', () => {
  it('전원 성공 → failCount = 0', () => {
    const votes: Record<string, boolean> = { p0: true, p1: true, p2: true };
    const failCount = Object.values(votes).filter((v) => !v).length;
    expect(failCount).toBe(0);
  });

  it('실패 1표 → failCount = 1', () => {
    const votes: Record<string, boolean> = { p0: true, p1: false, p2: true };
    const failCount = Object.values(votes).filter((v) => !v).length;
    expect(failCount).toBe(1);
  });

  it('전원 실패 → failCount = 팀 인원', () => {
    const votes: Record<string, boolean> = { p0: false, p1: false };
    const failCount = Object.values(votes).filter((v) => !v).length;
    expect(failCount).toBe(2);
  });

  it('투표 완료 감지: 투표 수 === 팀 인원', () => {
    const room = makeRoom(5);
    room.currentTeam = ['p0', 'p1', 'p2'];
    room.questVotes = { p0: true, p1: true }; // 2/3 완료
    expect(Object.keys(room.questVotes).length < room.currentTeam.length).toBe(true);

    room.questVotes['p2'] = true; // 3/3 완료
    expect(Object.keys(room.questVotes).length < room.currentTeam.length).toBe(false);
  });

  it('이미 투표한 플레이어 감지', () => {
    const room = makeRoom(5);
    room.questVotes = { p0: true };
    expect('p0' in room.questVotes).toBe(true);
    expect('p1' in room.questVotes).toBe(false);
  });
});

// ────────────────────────────────────────────

describe('퀘스트 결과 후 상태 전이', () => {
  let room: GameState;

  beforeEach(() => {
    room = makeRoom(5);
    room.players = [
      { id: 'p0', username: 'P0' },
      { id: 'p1', username: 'P1' },
      { id: 'p2', username: 'P2' },
      { id: 'p3', username: 'P3' },
      { id: 'p4', username: 'P4' },
    ];
    room.leaderIndex = 0;
  });

  it('퀘스트 성공 후 → 다음 라운드, proposal, round++', () => {
    const { winState } = simulateQuestResolution(room, 0); // 실패 0표 = 성공
    expect(winState).toBe('continue');
    expect(room.round).toBe(2);
    expect(room.phase).toBe('proposal');
  });

  it('퀘스트 실패 후 → 다음 라운드, proposal, round++', () => {
    const { winState, questFailed } = simulateQuestResolution(room, 1); // 실패 1표
    expect(winState).toBe('continue');
    expect(questFailed).toBe(true);
    expect(room.round).toBe(2);
    expect(room.phase).toBe('proposal');
  });

  it('라운드 전환 시 leaderIndex 1 증가', () => {
    room.leaderIndex = 0;
    simulateQuestResolution(room, 0);
    expect(room.leaderIndex).toBe(1);
  });

  it('리더가 마지막 플레이어면 첫 번째로 순환', () => {
    room.leaderIndex = 4; // 마지막 (5명)
    simulateQuestResolution(room, 0);
    expect(room.leaderIndex).toBe(0);
  });

  it('라운드 전환 시 proposalNumber 초기화', () => {
    room.proposalNumber = 3;
    simulateQuestResolution(room, 0);
    expect(room.proposalNumber).toBe(0);
  });

  it('라운드 전환 시 currentTeam, questVotes, teamVotes 초기화', () => {
    room.currentTeam = ['p0', 'p1'];
    room.questVotes = { p0: true };
    room.teamVotes = { p0: true, p1: false };
    simulateQuestResolution(room, 0);
    expect(room.currentTeam).toHaveLength(0);
    expect(Object.keys(room.questVotes)).toHaveLength(0);
    expect(Object.keys(room.teamVotes)).toHaveLength(0);
  });

  it('실패 3회 → phase=finished (악 승리)', () => {
    simulateQuestResolution(room, 1); // 실패 1
    simulateQuestResolution(room, 1); // 실패 2
    simulateQuestResolution(room, 1); // 실패 3
    expect(room.phase).toBe('finished');
    expect(room.questResults.filter((r) => r === 'fail')).toHaveLength(3);
  });

  it('성공 3회 → phase=assassination', () => {
    simulateQuestResolution(room, 0); // 성공 1
    simulateQuestResolution(room, 0); // 성공 2
    simulateQuestResolution(room, 0); // 성공 3
    expect(room.phase).toBe('assassination');
    expect(room.questResults.filter((r) => r === 'success')).toHaveLength(3);
  });

  it('성공 2, 실패 1, 성공 1 → 계속 (round 4)', () => {
    simulateQuestResolution(room, 0); // 성공
    simulateQuestResolution(room, 1); // 실패
    simulateQuestResolution(room, 0); // 성공
    expect(room.phase).toBe('proposal');
    expect(room.round).toBe(4);
  });

  it('악 승리 후 round는 더 이상 증가하지 않음', () => {
    simulateQuestResolution(room, 1);
    simulateQuestResolution(room, 1);
    const roundBeforeWin = room.round;
    simulateQuestResolution(room, 1); // 악 승리
    expect(room.round).toBe(roundBeforeWin); // round 그대로
    expect(room.phase).toBe('finished');
  });
});

// ────────────────────────────────────────────

describe('7명 이상 4라운드 - 실패 2표 특수 규칙', () => {
  it('7명 4라운드: 실패 1표 → 성공으로 처리', () => {
    const room = makeRoom(7);
    room.round = 4;
    const { questFailed } = simulateQuestResolution(room, 1);
    expect(questFailed).toBe(false);
    expect(room.questResults[0]).toBe('success');
  });

  it('7명 4라운드: 실패 2표 → 실패', () => {
    const room = makeRoom(7);
    room.round = 4;
    const { questFailed } = simulateQuestResolution(room, 2);
    expect(questFailed).toBe(true);
    expect(room.questResults[0]).toBe('fail');
  });

  it('6명 4라운드: 실패 1표 → 실패 (특수 규칙 미적용)', () => {
    const room = makeRoom(6);
    room.round = 4;
    const { questFailed } = simulateQuestResolution(room, 1);
    expect(questFailed).toBe(true);
  });
});

// ────────────────────────────────────────────

describe('역할별 퀘스트 투표 권한 (실패 버튼 여부)', () => {
  const evilRoles: RoleName[] = ['Assassin', 'Morgana', 'Mordred', 'Oberon', 'Minion'];
  const goodRoles: RoleName[] = ['Merlin', 'Percival', 'LoyalServant'];

  it.each(evilRoles)('%s → 악 진영 (실패 투표 가능)', (role) => {
    expect(ROLE_INFO[role].alignment).toBe('evil');
  });

  it.each(goodRoles)('%s → 선 진영 (성공만 가능)', (role) => {
    expect(ROLE_INFO[role].alignment).toBe('good');
  });

  it('역할 배정 후 각 플레이어의 투표 권한 확인', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const roles = assignRoles(ids, 5);
    // 5명: Merlin, Percival, LoyalServant(선 3), Assassin, Morgana(악 2)
    const evilCount = [...roles.values()].filter((r) => ROLE_INFO[r].alignment === 'evil').length;
    const goodCount = [...roles.values()].filter((r) => ROLE_INFO[r].alignment === 'good').length;
    expect(evilCount).toBe(2);
    expect(goodCount).toBe(3);
  });
});

// ────────────────────────────────────────────

describe('복합 시나리오 - 전체 게임 흐름', () => {
  it('악 승리 시나리오: 성공 2, 실패 3', () => {
    const room = makeRoom(5);
    simulateQuestResolution(room, 0); // R1 성공
    simulateQuestResolution(room, 1); // R2 실패
    simulateQuestResolution(room, 0); // R3 성공
    simulateQuestResolution(room, 1); // R4 실패
    simulateQuestResolution(room, 1); // R5 실패 → 악 승리
    expect(room.phase).toBe('finished');
    expect(room.questResults).toEqual(['success', 'fail', 'success', 'fail', 'fail']);
  });

  it('선 승리 시나리오: 성공 3 (이후 암살 단계)', () => {
    const room = makeRoom(5);
    simulateQuestResolution(room, 0); // R1 성공
    simulateQuestResolution(room, 1); // R2 실패
    simulateQuestResolution(room, 0); // R3 성공
    simulateQuestResolution(room, 1); // R4 실패
    simulateQuestResolution(room, 0); // R5 성공 → 암살 단계
    expect(room.phase).toBe('assassination');
  });

  it('3라운드 후 리더가 올바르게 순환', () => {
    const room = makeRoom(5);
    room.leaderIndex = 0;
    simulateQuestResolution(room, 0); // 라운드 1 종료 → leaderIndex 1
    expect(room.leaderIndex).toBe(1);
    simulateQuestResolution(room, 0); // 라운드 2 종료 → leaderIndex 2
    expect(room.leaderIndex).toBe(2);
    simulateQuestResolution(room, 0); // 라운드 3 종료 → 암살 단계 (leaderIndex 변경 안 됨)
    expect(room.phase).toBe('assassination');
  });

  it('questResults는 게임 종료 전까지 누적된다', () => {
    const room = makeRoom(5);
    simulateQuestResolution(room, 0);
    simulateQuestResolution(room, 1);
    simulateQuestResolution(room, 0);
    expect(room.questResults).toHaveLength(3);
    expect(room.questResults).toEqual(['success', 'fail', 'success']);
  });
});
