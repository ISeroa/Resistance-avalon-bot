export type GamePhase = 'waiting' | 'in_progress' | 'finished';

export interface Player {
  id: string;
  username: string;
}

export interface GameState {
  guildId: string;
  channelId: string;
  phase: GamePhase;
  players: Player[];
  createdAt: Date;
}

export function createGameState(guildId: string, channelId: string): GameState {
  return {
    guildId,
    channelId,
    phase: 'waiting',
    players: [],
    createdAt: new Date(),
  };
}
