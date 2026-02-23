/**
 * Phase 4 순수 로직 테스트: 팀 크기 테이블 + 투표 결과 계산.
 * propose/team_vote 로직 변경 시 반드시 npm test로 확인.
 */

import { describe, it, expect } from 'vitest';
import { getTeamSize, isMajorityApprove } from '../game/questConfig';

// ────────────────────────────────────────────

describe('getTeamSize - 라운드별 팀 크기', () => {
  it('5명 게임 전체 라운드', () => {
    expect(getTeamSize(5, 1)).toBe(2);
    expect(getTeamSize(5, 2)).toBe(3);
    expect(getTeamSize(5, 3)).toBe(2);
    expect(getTeamSize(5, 4)).toBe(3);
    expect(getTeamSize(5, 5)).toBe(3);
  });

  it('7명 게임 전체 라운드', () => {
    expect(getTeamSize(7, 1)).toBe(2);
    expect(getTeamSize(7, 2)).toBe(3);
    expect(getTeamSize(7, 3)).toBe(3);
    expect(getTeamSize(7, 4)).toBe(4);
    expect(getTeamSize(7, 5)).toBe(4);
  });

  it('10명 게임 전체 라운드', () => {
    expect(getTeamSize(10, 1)).toBe(3);
    expect(getTeamSize(10, 2)).toBe(4);
    expect(getTeamSize(10, 3)).toBe(4);
    expect(getTeamSize(10, 4)).toBe(5);
    expect(getTeamSize(10, 5)).toBe(5);
  });

  it('지원하지 않는 인원수는 예외', () => {
    expect(() => getTeamSize(4, 1)).toThrow();
    expect(() => getTeamSize(11, 1)).toThrow();
  });

  it('유효하지 않은 라운드는 예외', () => {
    expect(() => getTeamSize(5, 0)).toThrow();
    expect(() => getTeamSize(5, 6)).toThrow();
  });
});

// ────────────────────────────────────────────

describe('isMajorityApprove - 과반 찬성 계산', () => {
  it('5명 중 3명 찬성 → 통과', () => {
    const votes = { p1: true, p2: true, p3: true, p4: false, p5: false };
    expect(isMajorityApprove(votes, 5)).toBe(true);
  });

  it('5명 중 2명 찬성 → 부결', () => {
    const votes = { p1: true, p2: true, p3: false, p4: false, p5: false };
    expect(isMajorityApprove(votes, 5)).toBe(false);
  });

  it('6명 중 3명 찬성 → 부결 (과반 미달, 정확히 절반)', () => {
    const votes = { p1: true, p2: true, p3: true, p4: false, p5: false, p6: false };
    expect(isMajorityApprove(votes, 6)).toBe(false);
  });

  it('6명 중 4명 찬성 → 통과', () => {
    const votes = { p1: true, p2: true, p3: true, p4: true, p5: false, p6: false };
    expect(isMajorityApprove(votes, 6)).toBe(true);
  });

  it('전원 찬성 → 통과', () => {
    const votes = { p1: true, p2: true, p3: true, p4: true, p5: true };
    expect(isMajorityApprove(votes, 5)).toBe(true);
  });

  it('전원 반대 → 부결', () => {
    const votes = { p1: false, p2: false, p3: false, p4: false, p5: false };
    expect(isMajorityApprove(votes, 5)).toBe(false);
  });
});
