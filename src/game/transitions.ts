import { GameState } from './GameState';

/** team_vote 통과 → quest_vote */
export function toQuestVote(room: GameState): void {
  room.phase = 'quest_vote';
  room.isTransitioning = false;
  room.teamVotes = {};
  room.questVotes = {};
  room.activeTeamVoteMessageId = null;
}

/** 팀 부결 (proposalNumber < 5) → 다음 리더, proposal */
export function toProposalAfterRejection(room: GameState): void {
  room.proposalNumber++;
  room.teamVotes = {};
  room.currentTeam = [];
  room.leaderIndex = (room.leaderIndex + 1) % room.players.length;
  room.phase = 'proposal';
  room.activeTeamVoteMessageId = null;
}

/** 퀘스트 완료 → 다음 라운드, proposal */
export function toNextRound(room: GameState): void {
  room.round++;
  room.proposalNumber = 0;
  room.leaderIndex = (room.leaderIndex + 1) % room.players.length;
  room.currentTeam = [];
  room.questVotes = {};
  room.teamVotes = {};
  room.phase = 'proposal';
  room.activeTeamVoteMessageId = null;
}

/** 퀘스트 3연 성공 → assassination */
export function toAssassination(room: GameState): void {
  room.currentTeam = [];
  room.teamVotes = {};
  room.questVotes = {};
  room.phase = 'assassination';
  room.activeTeamVoteMessageId = null;
}

/** 게임 종료 (어떤 경로든) */
export function toFinished(room: GameState): void {
  room.phase = 'finished';
  room.activeTeamVoteMessageId = null;
}
