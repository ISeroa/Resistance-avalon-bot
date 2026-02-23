/**
 * timerManager 단위 테스트 (가짜 타이머 사용)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setQuestTimer, clearQuestTimer, QUEST_TIMEOUT_MS } from '../game/timerManager';

describe('QUEST_TIMEOUT_MS', () => {
  it('5분 = 300000ms', () => {
    expect(QUEST_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });
});

describe('setQuestTimer / clearQuestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('타이머 설정 후 ms 경과하면 콜백 호출', () => {
    const cb = vi.fn();
    setQuestTimer('g1', 'c1', cb, 1000);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('경과 전 clearQuestTimer 하면 콜백 미호출', () => {
    const cb = vi.fn();
    setQuestTimer('g1', 'c1', cb, 1000);
    clearQuestTimer('g1', 'c1');
    vi.advanceTimersByTime(2000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('같은 방에 타이머를 재설정하면 이전 타이머 취소', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    setQuestTimer('g1', 'c1', cb1, 1000);
    setQuestTimer('g1', 'c1', cb2, 2000); // 이전 타이머 대체

    vi.advanceTimersByTime(1500); // cb1 시간 경과
    expect(cb1).not.toHaveBeenCalled(); // cb1은 취소됨

    vi.advanceTimersByTime(1000); // cb2 시간 경과
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('다른 방 타이머는 서로 영향 없음', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    setQuestTimer('g1', 'c1', cb1, 500);
    setQuestTimer('g1', 'c2', cb2, 1000); // 다른 채널

    vi.advanceTimersByTime(600);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('clearQuestTimer - 없는 방은 에러 없이 통과', () => {
    expect(() => clearQuestTimer('no-guild', 'no-channel')).not.toThrow();
  });

  it('clearQuestTimer 후 같은 방에 타이머 재설정 가능', () => {
    const cb = vi.fn();
    setQuestTimer('g1', 'c1', cb, 1000);
    clearQuestTimer('g1', 'c1');

    const cb2 = vi.fn();
    setQuestTimer('g1', 'c1', cb2, 500);
    vi.advanceTimersByTime(600);

    expect(cb).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('기본 ms는 QUEST_TIMEOUT_MS (5분)', () => {
    const cb = vi.fn();
    setQuestTimer('g1', 'c1', cb); // ms 생략

    vi.advanceTimersByTime(QUEST_TIMEOUT_MS - 1);
    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('guildId가 다르면 별도 타이머', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    setQuestTimer('g1', 'c1', cb1, 500);
    setQuestTimer('g2', 'c1', cb2, 1000); // 다른 길드, 같은 채널

    clearQuestTimer('g1', 'c1'); // g1만 취소

    vi.advanceTimersByTime(1500);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
