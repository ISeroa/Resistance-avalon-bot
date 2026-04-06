/**
 * RoleConfig 관련 함수 회귀 테스트.
 * validateRoleConfig / buildRolePool / getDefaultRoleConfig / assignRolesFromConfig 커버.
 */

import { describe, it, expect } from 'vitest';
import {
  validateRoleConfig,
  buildRolePool,
  getDefaultRoleConfig,
  assignRolesFromConfig,
  DEFAULT_ROLE_TABLE,
  ROLE_INFO,
  RoleConfig,
} from '../game/roles';

// ── getDefaultRoleConfig ───────────────────────────────────

describe('getDefaultRoleConfig', () => {
  it('5~10명 기본 설정이 모두 정의됨', () => {
    for (let n = 5; n <= 10; n++) {
      expect(() => getDefaultRoleConfig(n)).not.toThrow();
    }
  });

  it('반환값은 원본 테이블의 복사본 (수정해도 원본 불변)', () => {
    const cfg = getDefaultRoleConfig(7);
    cfg.loyal = 999;
    expect(DEFAULT_ROLE_TABLE[7]!.loyal).toBe(3);
  });

  it('지원하지 않는 인원수는 예외', () => {
    expect(() => getDefaultRoleConfig(4)).toThrow();
    expect(() => getDefaultRoleConfig(11)).toThrow();
  });

  it('7명 기본 설정: merlin1 assassin1 loyal3 minion2', () => {
    const cfg = getDefaultRoleConfig(7);
    expect(cfg).toEqual({ merlin: 1, assassin: 1, loyal: 3, minion: 2 });
  });

  it('5명 기본 설정 총합 === 5', () => {
    const cfg = getDefaultRoleConfig(5);
    expect(cfg.merlin + cfg.assassin + cfg.loyal + cfg.minion).toBe(5);
  });

  it.each([5, 6, 7, 8, 9, 10])('%i명 기본 설정 총합 === 인원수', (n) => {
    const cfg = getDefaultRoleConfig(n);
    expect(cfg.merlin + cfg.assassin + cfg.loyal + cfg.minion).toBe(n);
  });
});

// ── validateRoleConfig ────────────────────────────────────

describe('validateRoleConfig - 정상 케이스', () => {
  it('7명 유효한 설정은 null 반환', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 3, minion: 2 };
    expect(validateRoleConfig(cfg, 7)).toBeNull();
  });

  it('5명 유효한 설정은 null 반환', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 2, minion: 1 };
    expect(validateRoleConfig(cfg, 5)).toBeNull();
  });

  it('loyal 0, minion 높은 설정도 총합 맞으면 통과', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 0, minion: 5 };
    expect(validateRoleConfig(cfg, 7)).toBeNull();
  });
});

describe('validateRoleConfig - 오류 케이스', () => {
  it('총합이 플레이어 수와 다르면 오류', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 3, minion: 3 }; // 합=8, 인원=7
    expect(validateRoleConfig(cfg, 7)).toMatch(/총합/);
  });

  it('merlin이 0이면 오류', () => {
    const cfg: RoleConfig = { merlin: 0, assassin: 1, loyal: 4, minion: 2 };
    expect(validateRoleConfig(cfg, 7)).toMatch(/멀린/);
  });

  it('assassin이 0이면 오류', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 0, loyal: 4, minion: 2 };
    expect(validateRoleConfig(cfg, 7)).toMatch(/암살자/);
  });

  it('loyal이 음수면 오류', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: -1, minion: 6 };
    expect(validateRoleConfig(cfg, 7)).toMatch(/충신/);
  });

  it('minion이 음수면 오류', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 7, minion: -2 };
    expect(validateRoleConfig(cfg, 7)).toMatch(/부하/);
  });
});

// ── buildRolePool ─────────────────────────────────────────

describe('buildRolePool', () => {
  it('RoleConfig 수치만큼 역할 풀 생성', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 3, minion: 2 };
    const pool = buildRolePool(cfg);
    expect(pool).toHaveLength(7);
    expect(pool.filter((r) => r === 'Merlin')).toHaveLength(1);
    expect(pool.filter((r) => r === 'Assassin')).toHaveLength(1);
    expect(pool.filter((r) => r === 'LoyalServant')).toHaveLength(3);
    expect(pool.filter((r) => r === 'Minion')).toHaveLength(2);
  });

  it('모든 역할은 ROLE_INFO에 정의된 타입', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 2, minion: 1 };
    const pool = buildRolePool(cfg);
    pool.forEach((r) => expect(ROLE_INFO[r]).toBeDefined());
  });

  it('각 역할의 진영 검증: Merlin/LoyalServant=good, Assassin/Minion=evil', () => {
    const cfg: RoleConfig = { merlin: 1, assassin: 1, loyal: 2, minion: 1 };
    const pool = buildRolePool(cfg);
    const good = pool.filter((r) => ROLE_INFO[r].alignment === 'good');
    const evil = pool.filter((r) => ROLE_INFO[r].alignment === 'evil');
    expect(good).toHaveLength(3); // merlin1 + loyal2
    expect(evil).toHaveLength(2); // assassin1 + minion1
  });
});

// ── assignRolesFromConfig ─────────────────────────────────

describe('assignRolesFromConfig', () => {
  const ids7 = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];
  const cfg7: RoleConfig = { merlin: 1, assassin: 1, loyal: 3, minion: 2 };

  it('모든 플레이어가 역할을 배정받음', () => {
    const roles = assignRolesFromConfig(ids7, cfg7);
    expect(roles.size).toBe(7);
    ids7.forEach((id) => expect(roles.has(id)).toBe(true));
  });

  it('역할 수가 RoleConfig와 일치', () => {
    const roles = assignRolesFromConfig(ids7, cfg7);
    const values = [...roles.values()];
    expect(values.filter((r) => r === 'Merlin')).toHaveLength(1);
    expect(values.filter((r) => r === 'Assassin')).toHaveLength(1);
    expect(values.filter((r) => r === 'LoyalServant')).toHaveLength(3);
    expect(values.filter((r) => r === 'Minion')).toHaveLength(2);
  });

  it('선/악 진영 수가 올바름', () => {
    const roles = assignRolesFromConfig(ids7, cfg7);
    const values = [...roles.values()];
    const good = values.filter((r) => ROLE_INFO[r].alignment === 'good');
    const evil = values.filter((r) => ROLE_INFO[r].alignment === 'evil');
    expect(good).toHaveLength(4); // merlin1 + loyal3
    expect(evil).toHaveLength(3); // assassin1 + minion2
  });

  it('5명 기본 설정으로 배정 가능', () => {
    const ids5 = ['a', 'b', 'c', 'd', 'e'];
    const cfg5 = getDefaultRoleConfig(5);
    const roles = assignRolesFromConfig(ids5, cfg5);
    expect(roles.size).toBe(5);
    const values = [...roles.values()];
    expect(values.filter((r) => r === 'Merlin')).toHaveLength(1);
    expect(values.filter((r) => r === 'Assassin')).toHaveLength(1);
  });
});
