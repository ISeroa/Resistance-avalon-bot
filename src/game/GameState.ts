import { RoleName } from './roles';

export type GamePhase = 'waiting' | 'in_progress' | 'finished';
export type QuestResult = 'success' | 'fail';

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

  // Phase 3: 역할 배정 (절대 채널에 출력 금지)
  roles: Map<string, RoleName>;

  // Phase 4+: 게임 진행
  round: number;           // 현재 라운드 (1~5)
  leaderIndex: number;     // players 배열 기준 현재 리더 인덱스
  proposalNumber: number;  // 현재 라운드의 제안 횟수 (5회 연속 부결 시 악 승리)
  questResults: QuestResult[];
  currentTeam: string[];           // 현재 제안된 팀 (userId[])
  teamVotes: Record<string, boolean>;  // 팀 찬반 투표
  questVotes: Record<string, boolean>; // 퀘스트 투표 (절대 채널에 출력 금지)
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
    roles: new Map(),
    round: 0,
    leaderIndex: 0,
    proposalNumber: 0,
    questResults: [],
    currentTeam: [],
    teamVotes: {},
    questVotes: {},
  };
}
