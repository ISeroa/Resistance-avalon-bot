import { GameState, createGameState } from './GameState';
import { clearQuestTimer, clearCleanupTimer } from './timerManager';

// key 형식: `${guildId}-${channelId}`
type RoomKey = string;

function makeKey(guildId: string, channelId: string): RoomKey {
  return `${guildId}-${channelId}`;
}

const rooms = new Map<RoomKey, GameState>();

export function getRoom(guildId: string, channelId: string): GameState | undefined {
  return rooms.get(makeKey(guildId, channelId));
}

export function createRoom(
  guildId: string,
  channelId: string,
  hostUserId: string,
): GameState {
  const key = makeKey(guildId, channelId);
  const state = createGameState(guildId, channelId, hostUserId);
  rooms.set(key, state);
  return state;
}

export function deleteRoom(guildId: string, channelId: string): boolean {
  const room = rooms.get(makeKey(guildId, channelId));
  if (room) clearCleanupTimer(room);
  clearQuestTimer(guildId, channelId);
  return rooms.delete(makeKey(guildId, channelId));
}

export function hasRoom(guildId: string, channelId: string): boolean {
  return rooms.has(makeKey(guildId, channelId));
}

export function getAllRooms(): GameState[] {
  return Array.from(rooms.values());
}
