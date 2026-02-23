/**
 * Phase 5 순수 로직 테스트: 2표 실패 조건 + 퀘스트 실패 판정 + 승리 조건 계산.
 * quest 로직 변경 시 반드시 npm test로 확인.
 */

import { describe, it, expect } from 'vitest';
import { needsTwoFails, isQuestFailed, checkWinCondition } from '../game/questConfig';

// ────────────────────────────────────────────

describe('needsTwoFails - 2표 실패 조건', () => {
  it('7명 4라운드 → true', () => {
    expect(needsTwoFails(7, 4)).toBe(true);
  });

  it('8명 4라운드 → true', () => {
    expect(needsTwoFails(8, 4)).toBe(true);
  });

  it('10명 4라운드 → true', () => {
    expect(needsTwoFails(10, 4)).toBe(true);
  });

  it('6명 4라운드 → false (7명 미만)', () => {
    expect(needsTwoFails(6, 4)).toBe(false);
  });

  it('5명 4라운드 → false', () => {
    expect(needsTwoFails(5, 4)).toBe(false);
  });

  it('7명 3라운드 → false (4라운드 아님)', () => {
    expect(needsTwoFails(7, 3)).toBe(false);
  });

  it('7명 5라운드 → false', () => {
    expect(needsTwoFails(7, 5)).toBe(false);
  });
});

// ────────────────────────────────────────────

describe('isQuestFailed - 퀘스트 실패 판정', () => {
  it('실패 0표, 1표 필요 → 성공', () => {
    expect(isQuestFailed(0, 5, 1)).toBe(false);
  });

  it('실패 1표, 1표 필요 → 실패', () => {
    expect(isQuestFailed(1, 5, 1)).toBe(true);
  });

  it('실패 1표, 2표 필요 (7명 4라운드) → 성공', () => {
    expect(isQuestFailed(1, 7, 4)).toBe(false);
  });

  it('실패 2표, 2표 필요 (7명 4라운드) → 실패', () => {
    expect(isQuestFailed(2, 7, 4)).toBe(true);
  });

  it('실패 0표, 2표 필요 (8명 4라운드) → 성공', () => {
    expect(isQuestFailed(0, 8, 4)).toBe(false);
  });
});

// ────────────────────────────────────────────

describe('checkWinCondition - 승리 조건', () => {
  it('퀘스트 실패 3번 → 악 승리', () => {
    expect(checkWinCondition(['fail', 'fail', 'fail'])).toBe('evil_wins');
  });

  it('퀘스트 성공 3번 → 암살 단계', () => {
    expect(checkWinCondition(['success', 'success', 'success'])).toBe('good_wins_assassination');
  });

  it('성공 2, 실패 1 → 계속', () => {
    expect(checkWinCondition(['success', 'fail', 'success'])).toBe('continue');
  });

  it('실패 2번 → 계속', () => {
    expect(checkWinCondition(['fail', 'fail'])).toBe('continue');
  });

  it('성공 2, 실패 2 → 계속', () => {
    expect(checkWinCondition(['success', 'success', 'fail', 'fail'])).toBe('continue');
  });

  it('성공 3, 실패 2 → 암살 단계 (성공 3이 우선)', () => {
    expect(checkWinCondition(['success', 'fail', 'success', 'fail', 'success'])).toBe('good_wins_assassination');
  });

  it('빈 배열 → 계속', () => {
    expect(checkWinCondition([])).toBe('continue');
  });
});
