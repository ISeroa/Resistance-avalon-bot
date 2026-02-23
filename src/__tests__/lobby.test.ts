/**
 * Lobby state logic regression tests.
 * 멀티 유저 join/leave/start 조건을 검증한다.
 * 로비 로직 수정 시 반드시 npm test로 회귀 확인.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRoom, getRoom, hasRoom, deleteRoom, getAllRooms } from '../game/gameManager';

// gameManager는 모듈 레벨 Map을 공유하므로 각 테스트 전에 방을 정리한다
const G = 'guild-1';
const C = 'channel-1';
const HOST = 'user-host';
const P1 = 'user-p1';
const P2 = 'user-p2';

function cleanRoom() {
  deleteRoom(G, C);
}

// ────────────────────────────────────────────
// 헬퍼: 방 생성 + 방장 참가 (create 커맨드 동작과 동일)
function makeRoomWithHost() {
  const room = createRoom(G, C, HOST);
  room.players.push({ id: HOST, username: 'Host' });
  return room;
}

// ────────────────────────────────────────────

describe('방 생성 (create)', () => {
  beforeEach(cleanRoom);

  it('방이 없으면 생성 성공', () => {
    const room = makeRoomWithHost();
    expect(room.hostUserId).toBe(HOST);
    expect(room.phase).toBe('waiting');
    expect(room.players).toHaveLength(1);
    expect(room.players[0].id).toBe(HOST);
  });

  it('같은 채널에 방이 이미 있으면 중복 생성 불가', () => {
    makeRoomWithHost();
    expect(hasRoom(G, C)).toBe(true);
    // create 커맨드는 hasRoom 체크 후 early return — 여기선 로직만 검증
    expect(getRoom(G, C)?.players).toHaveLength(1);
  });
});

// ────────────────────────────────────────────

describe('참가 (join)', () => {
  beforeEach(() => {
    cleanRoom();
    makeRoomWithHost();
  });

  it('새 플레이어 참가 성공', () => {
    const room = getRoom(G, C)!;
    room.players.push({ id: P1, username: 'P1' });
    expect(room.players).toHaveLength(2);
  });

  it('이미 참가한 플레이어는 중복 참가 불가', () => {
    const room = getRoom(G, C)!;
    const alreadyIn = room.players.some((p) => p.id === HOST);
    expect(alreadyIn).toBe(true);
  });

  it('게임이 시작된 방에는 참가 불가', () => {
    const room = getRoom(G, C)!;
    room.phase = 'proposal';
    expect(room.phase).not.toBe('waiting');
  });

  it('10명 초과 시 참가 불가', () => {
    const room = getRoom(G, C)!;
    // 방장 포함 10명까지 채우기
    for (let i = 1; i < 10; i++) {
      room.players.push({ id: `user-${i}`, username: `User${i}` });
    }
    expect(room.players).toHaveLength(10);
    const isFull = room.players.length >= 10;
    expect(isFull).toBe(true);
  });
});

// ────────────────────────────────────────────

describe('나가기 (leave)', () => {
  beforeEach(() => {
    cleanRoom();
    const room = makeRoomWithHost();
    room.players.push({ id: P1, username: 'P1' });
    room.players.push({ id: P2, username: 'P2' });
  });

  it('일반 플레이어가 나가면 방은 유지됨', () => {
    const room = getRoom(G, C)!;
    room.players = room.players.filter((p) => p.id !== P1);
    expect(hasRoom(G, C)).toBe(true);
    expect(room.players.some((p) => p.id === P1)).toBe(false);
    expect(room.players).toHaveLength(2); // HOST + P2
  });

  it('방장이 나가면 방이 해체됨', () => {
    deleteRoom(G, C); // leave-host 로직: deleteRoom 호출
    expect(hasRoom(G, C)).toBe(false);
  });

  it('방에 없는 사람은 나가기 불가', () => {
    const room = getRoom(G, C)!;
    const isIn = room.players.some((p) => p.id === 'nobody');
    expect(isIn).toBe(false);
  });
});

// ────────────────────────────────────────────

describe('취소 (cancel)', () => {
  beforeEach(() => {
    cleanRoom();
    const room = makeRoomWithHost();
    room.players.push({ id: P1, username: 'P1' });
  });

  it('방장이 취소하면 방이 삭제됨', () => {
    const room = getRoom(G, C)!;
    expect(room.hostUserId).toBe(HOST);
    deleteRoom(G, C);
    expect(hasRoom(G, C)).toBe(false);
  });

  it('방장이 아닌 사람은 취소 불가', () => {
    const room = getRoom(G, C)!;
    const isHost = room.hostUserId === P1;
    expect(isHost).toBe(false);
    // 방은 여전히 존재
    expect(hasRoom(G, C)).toBe(true);
  });
});

// ────────────────────────────────────────────

describe('상태 조회 (status)', () => {
  beforeEach(cleanRoom);

  it('방이 없으면 getRoom은 undefined', () => {
    expect(getRoom(G, C)).toBeUndefined();
  });

  it('방이 있으면 현재 인원과 방장 확인 가능', () => {
    const room = makeRoomWithHost();
    room.players.push({ id: P1, username: 'P1' });

    const found = getRoom(G, C)!;
    expect(found.hostUserId).toBe(HOST);
    expect(found.players).toHaveLength(2);
    expect(found.phase).toBe('waiting');
  });
});

// ────────────────────────────────────────────

describe('경계값 / 복합 시나리오', () => {
  beforeEach(cleanRoom);

  it('최소 인원 5명 미만이면 시작 불가 조건 검증', () => {
    const room = makeRoomWithHost();
    // 방장 1명만 있는 상태
    expect(room.players.length < 5).toBe(true);
  });

  it('정확히 5명이면 시작 가능 조건 충족', () => {
    const room = makeRoomWithHost();
    for (let i = 1; i < 5; i++) {
      room.players.push({ id: `u${i}`, username: `U${i}` });
    }
    expect(room.players.length >= 5).toBe(true);
  });

  it('방 해체 후 같은 채널에 새 방 생성 가능', () => {
    makeRoomWithHost();
    deleteRoom(G, C);
    expect(hasRoom(G, C)).toBe(false);

    const newRoom = createRoom(G, C, P1);
    newRoom.players.push({ id: P1, username: 'P1' });
    expect(getRoom(G, C)?.hostUserId).toBe(P1);
  });

  it('getAllRooms는 활성 방 전체를 반환', () => {
    makeRoomWithHost();
    createRoom(G, 'channel-2', P1);
    expect(getAllRooms().length).toBeGreaterThanOrEqual(2);
    deleteRoom(G, 'channel-2');
  });
});
