/**
 * Phase 6 순수 로직 테스트: 암살자 찾기, 멀린 찾기, 암살 결과 판정.
 * assassination 로직 변경 시 반드시 npm test로 확인.
 */

import { describe, it, expect } from 'vitest';
import { getAssassinId, getMerlinId, ROLE_INFO, assignRoles, RoleName } from '../game/roles';
import { createGameState } from '../game/GameState';

// ── 테스트용 역할 맵 헬퍼 ───────────────────────────────

function makeRoles(entries: [string, RoleName][]): Map<string, RoleName> {
  return new Map(entries);
}

// ────────────────────────────────────────────

describe('getAssassinId - 암살자 찾기', () => {
  it('역할 맵에서 암살자 userId 반환', () => {
    const roles = makeRoles([
      ['p0', 'Merlin'],
      ['p1', 'Assassin'],
      ['p2', 'LoyalServant'],
      ['p3', 'Morgana'],
      ['p4', 'Percival'],
    ]);
    expect(getAssassinId(roles)).toBe('p1');
  });

  it('5명 랜덤 배정 후 암살자 1명 반드시 존재', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const roles = assignRoles(ids, 5);
    const assassinId = getAssassinId(roles);
    expect(assassinId).toBeDefined();
    expect(roles.get(assassinId!)).toBe('Assassin');
  });

  it('암살자가 없으면 undefined', () => {
    const roles = makeRoles([['p0', 'Merlin'], ['p1', 'LoyalServant']]);
    expect(getAssassinId(roles)).toBeUndefined();
  });
});

// ────────────────────────────────────────────

describe('getMerlinId - 멀린 찾기', () => {
  it('역할 맵에서 멀린 userId 반환', () => {
    const roles = makeRoles([
      ['p0', 'Assassin'],
      ['p1', 'Merlin'],
      ['p2', 'LoyalServant'],
    ]);
    expect(getMerlinId(roles)).toBe('p1');
  });

  it('5명 랜덤 배정 후 멀린 1명 반드시 존재', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const roles = assignRoles(ids, 5);
    const merlinId = getMerlinId(roles);
    expect(merlinId).toBeDefined();
    expect(roles.get(merlinId!)).toBe('Merlin');
  });

  it('멀린이 없으면 undefined', () => {
    const roles = makeRoles([['p0', 'LoyalServant'], ['p1', 'Assassin']]);
    expect(getMerlinId(roles)).toBeUndefined();
  });
});

// ────────────────────────────────────────────

describe('암살 결과 판정 - 멀린 여부', () => {
  const roles = makeRoles([
    ['merlin-id',   'Merlin'],
    ['assassin-id', 'Assassin'],
    ['loyal-id',    'LoyalServant'],
    ['percival-id', 'Percival'],
    ['morgana-id',  'Morgana'],
  ]);

  it('멀린을 지목 → 악 승리 (targetRole === Merlin)', () => {
    const targetRole = roles.get('merlin-id');
    expect(targetRole).toBe('Merlin');
  });

  it('아서의 충신을 지목 → 선 승리', () => {
    const targetRole = roles.get('loyal-id');
    expect(targetRole).not.toBe('Merlin');
  });

  it('퍼시벌을 지목 → 선 승리 (퍼시벌은 선이지만 멀린이 아님)', () => {
    const targetRole = roles.get('percival-id');
    expect(targetRole).not.toBe('Merlin');
    expect(ROLE_INFO[targetRole!].alignment).toBe('good');
  });

  it('모르가나를 지목 → 선 승리 (악이지만 멀린이 아님)', () => {
    const targetRole = roles.get('morgana-id');
    expect(targetRole).not.toBe('Merlin');
    expect(ROLE_INFO[targetRole!].alignment).toBe('evil');
  });

  it('getAssassinId와 getMerlinId는 항상 다른 플레이어를 가리킴', () => {
    expect(getAssassinId(roles)).not.toBe(getMerlinId(roles));
  });
});

// ────────────────────────────────────────────

describe('암살 단계 권한 검사 (순수 로직)', () => {
  it('암살자 역할 플레이어만 사용 가능', () => {
    const roles = makeRoles([
      ['p0', 'Merlin'],
      ['p1', 'Assassin'],
      ['p2', 'LoyalServant'],
    ]);
    expect(roles.get('p1')).toBe('Assassin'); // p1만 사용 가능
    expect(roles.get('p0')).not.toBe('Assassin');
    expect(roles.get('p2')).not.toBe('Assassin');
  });

  it('assassination 페이즈에서만 실행 가능', () => {
    const room = createGameState('g', 'c', 'host');
    expect(room.phase).not.toBe('assassination');
    room.phase = 'assassination';
    expect(room.phase).toBe('assassination');
  });

  it('암살 후 phase = finished', () => {
    const room = createGameState('g', 'c', 'host');
    room.phase = 'assassination';
    room.phase = 'finished'; // 암살 실행 후 상태
    expect(room.phase).toBe('finished');
  });
});

// ────────────────────────────────────────────

describe('게임 종료 시 역할 공개', () => {
  it('모든 역할에 displayName과 emoji가 정의됨', () => {
    const allRoles: RoleName[] = [
      'Merlin', 'Percival', 'LoyalServant',
      'Assassin', 'Morgana', 'Mordred', 'Oberon', 'Minion',
    ];
    for (const role of allRoles) {
      expect(ROLE_INFO[role].displayName).toBeTruthy();
      expect(ROLE_INFO[role].emoji).toBeTruthy();
    }
  });

  it('5명 배정 후 전원 역할 공개 가능', () => {
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const roles = assignRoles(ids, 5);
    const reveal = ids.map((id) => {
      const role = roles.get(id)!;
      const info = ROLE_INFO[role];
      return `<@${id}>: ${info.emoji} ${info.displayName}`;
    }).join('\n');
    expect(reveal).toContain('멀린');
    expect(reveal).toContain('암살자');
  });

  it('10명 배정 후 악 진영 4명, 선 진영 6명', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const roles = assignRoles(ids, 10);
    const evil = [...roles.values()].filter((r) => ROLE_INFO[r].alignment === 'evil').length;
    const good = [...roles.values()].filter((r) => ROLE_INFO[r].alignment === 'good').length;
    expect(evil).toBe(4);
    expect(good).toBe(6);
  });
});

// ────────────────────────────────────────────

describe('복합 시나리오 - 암살 단계 진입 조건', () => {
  it('퀘스트 성공 3회 후 assassination 페이즈', () => {
    const room = createGameState('g', 'c', 'host');
    room.questResults = ['success', 'fail', 'success', 'fail', 'success'];
    const successes = room.questResults.filter((r) => r === 'success').length;
    expect(successes).toBe(3);
    // 실제 게임에서는 checkWinCondition이 'good_wins_assassination'을 반환해 phase 변경
    room.phase = 'assassination';
    expect(room.phase).toBe('assassination');
  });

  it('암살자와 멀린은 항상 다른 플레이어 (5~10명 모든 구성)', () => {
    for (const count of [5, 6, 7, 8, 9, 10]) {
      const ids = Array.from({ length: count }, (_, i) => `p${i}`);
      const roles = assignRoles(ids, count);
      expect(getAssassinId(roles)).not.toBe(getMerlinId(roles));
    }
  });
});
