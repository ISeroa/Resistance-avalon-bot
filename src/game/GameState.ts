export type GamePhase = 'waiting' | 'in_progress' | 'finished';

export interface Player {
  id: string;
  username: string;
}

export interface GameState {
  guildId: string;
  channelId: string;
  hostUserId: string;
  phase: GamePhase;
  players: Player[];
  createdAt: Date;
}

export function createGameState(
  guildId: string,
  channelId: string,
  hostUserId: string,
): GameState {
  return {
    guildId,
    channelId,
    hostUserId,
    phase: 'waiting',
    players: [],
    createdAt: new Date(),
  };
}
