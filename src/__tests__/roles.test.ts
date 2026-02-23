/**
 * 역할 배정 및 DM 메시지 생성 회귀 테스트.
 * 역할 지식 규칙이나 역할 구성 변경 시 반드시 npm test로 확인.
 */

import { describe, it, expect } from 'vitest';
import { assignRoles, buildDmMessage, ROLE_INFO, RoleName } from '../game/roles';

function makeRoles(entries: [string, RoleName][]): Map<string, RoleName> {
  return new Map(entries);
}

// 5명 고정 시나리오: p1=Merlin, p2=Percival, p3=LoyalServant, p4=Assassin, p5=Morgana
const FIVE_ROLES = makeRoles([
  ['p1', 'Merlin'],
  ['p2', 'Percival'],
  ['p3', 'LoyalServant'],
  ['p4', 'Assassin'],
  ['p5', 'Morgana'],
]);

// 7명 고정 시나리오 (Oberon 포함)
const SEVEN_ROLES = makeRoles([
  ['p1', 'Merlin'],
  ['p2', 'Percival'],
  ['p3', 'LoyalServant'],
  ['p4', 'LoyalServant'],
  ['p5', 'Assassin'],
  ['p6', 'Morgana'],
  ['p7', 'Oberon'],
]);

// 9명 고정 시나리오 (Mordred 포함)
const NINE_ROLES = makeRoles([
  ['p1', 'Merlin'],
  ['p2', 'Percival'],
  ['p3', 'LoyalServant'],
  ['p4', 'LoyalServant'],
  ['p5', 'LoyalServant'],
  ['p6', 'LoyalServant'],
  ['p7', 'Assassin'],
  ['p8', 'Morgana'],
  ['p9', 'Mordred'],
]);

// ────────────────────────────────────────────

describe('assignRoles - 역할 배정', () => {
  it('5명: 올바른 개수와 필수 역할 포함', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const roles = assignRoles(ids, 5);

    expect(roles.size).toBe(5);
    const values = [...roles.values()];
    expect(values.filter((r) => r === 'Merlin')).toHaveLength(1);
    expect(values.filter((r) => r === 'Assassin')).toHaveLength(1);
    expect(values.filter((r) => r === 'Percival')).toHaveLength(1);
    expect(values.filter((r) => r === 'Morgana')).toHaveLength(1);

    const good = values.filter((r) => ROLE_INFO[r].alignment === 'good');
    const evil = values.filter((r) => ROLE_INFO[r].alignment === 'evil');
    expect(good).toHaveLength(3);
    expect(evil).toHaveLength(2);
  });

  it('10명: 선 6 악 4', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `u${i}`);
    const roles = assignRoles(ids, 10);

    expect(roles.size).toBe(10);
    const values = [...roles.values()];
    expect(values.filter((r) => ROLE_INFO[r].alignment === 'good')).toHaveLength(6);
    expect(values.filter((r) => ROLE_INFO[r].alignment === 'evil')).toHaveLength(4);
  });

  it('모든 플레이어가 역할을 배정받음', () => {
    const ids = ['x', 'y', 'z', 'w', 'v'];
    const roles = assignRoles(ids, 5);
    ids.forEach((id) => expect(roles.has(id)).toBe(true));
  });

  it('지원하지 않는 인원수는 예외', () => {
    expect(() => assignRoles(['a', 'b', 'c', 'd'], 4)).toThrow();
    expect(() => assignRoles(Array(11).fill('u'), 11)).toThrow();
  });
});

// ────────────────────────────────────────────

describe('buildDmMessage - Merlin', () => {
  it('악(모드레드 제외)을 모두 봄 (5명: Assassin + Morgana)', () => {
    const msg = buildDmMessage('p1', 'Merlin', FIVE_ROLES);
    expect(msg).toContain('<@p4>'); // Assassin
    expect(msg).toContain('<@p5>'); // Morgana
    expect(msg).not.toContain('<@p2>');
    expect(msg).not.toContain('<@p3>');
  });

  it('Oberon은 봄 (악이고 Mordred가 아님)', () => {
    const msg = buildDmMessage('p1', 'Merlin', SEVEN_ROLES);
    expect(msg).toContain('<@p7>'); // Oberon
  });

  it('Mordred는 보지 못함', () => {
    const msg = buildDmMessage('p1', 'Merlin', NINE_ROLES);
    expect(msg).not.toContain('<@p9>'); // Mordred 숨겨짐
    expect(msg).toContain('<@p7>');     // Assassin은 봄
    expect(msg).toContain('<@p8>');     // Morgana는 봄
  });

  it('자기 자신은 목록에 없음', () => {
    const msg = buildDmMessage('p1', 'Merlin', FIVE_ROLES);
    const evilSection = msg.split('악의 세력')[1] ?? '';
    expect(evilSection).not.toContain('<@p1>');
  });
});

// ────────────────────────────────────────────

describe('buildDmMessage - Percival', () => {
  it('Merlin과 Morgana를 봄 (구분 불가)', () => {
    const msg = buildDmMessage('p2', 'Percival', FIVE_ROLES);
    expect(msg).toContain('<@p1>'); // Merlin
    expect(msg).toContain('<@p5>'); // Morgana
    expect(msg).not.toContain('<@p4>'); // Assassin은 못 봄
    expect(msg).not.toContain('<@p3>');
  });
});

// ────────────────────────────────────────────

describe('buildDmMessage - 악 진영', () => {
  it('Assassin은 다른 악(Oberon 제외)을 봄', () => {
    const msg = buildDmMessage('p5', 'Assassin', SEVEN_ROLES);
    expect(msg).toContain('<@p6>');     // Morgana
    expect(msg).not.toContain('<@p7>'); // Oberon은 못 봄
    expect(msg).not.toContain('<@p1>'); // Merlin은 못 봄
  });

  it('Morgana는 다른 악(Oberon 제외)을 봄', () => {
    const msg = buildDmMessage('p6', 'Morgana', SEVEN_ROLES);
    expect(msg).toContain('<@p5>');     // Assassin
    expect(msg).not.toContain('<@p7>'); // Oberon은 못 봄
  });

  it('Mordred는 다른 악(Oberon 제외)을 봄', () => {
    const msg = buildDmMessage('p9', 'Mordred', NINE_ROLES);
    expect(msg).toContain('<@p7>');     // Assassin
    expect(msg).toContain('<@p8>');     // Morgana
    expect(msg).not.toContain('<@p1>'); // Merlin은 못 봄
  });
});

// ────────────────────────────────────────────

describe('buildDmMessage - Oberon', () => {
  it('아무도 보지 못함', () => {
    const msg = buildDmMessage('p7', 'Oberon', SEVEN_ROLES);
    expect(msg).not.toContain('<@p5>');
    expect(msg).not.toContain('<@p6>');
    expect(msg).toContain('동료 악당들을 알 수 없습니다');
  });
});

// ────────────────────────────────────────────

describe('buildDmMessage - LoyalServant', () => {
  it('아무도 보지 못함', () => {
    const msg = buildDmMessage('p3', 'LoyalServant', FIVE_ROLES);
    expect(msg).not.toContain('<@p1>');
    expect(msg).not.toContain('<@p4>');
    expect(msg).not.toContain('<@p5>');
    expect(msg).toContain('특별한 정보를 갖지 않습니다');
  });
});

// ────────────────────────────────────────────

describe('buildDmMessage - 메시지 공통 형식', () => {
  const roles: RoleName[] = ['Merlin', 'Percival', 'LoyalServant', 'Assassin', 'Morgana'];

  it.each(roles)('%s: 역할명과 진영 정보를 포함', (role) => {
    const info = ROLE_INFO[role];
    const msg = buildDmMessage('p1', role, FIVE_ROLES);
    expect(msg).toContain(info.displayName);
    expect(msg).toContain(info.emoji);
  });
});
