import { db } from './database';
import { GameState } from '../game/GameState';
import { ROLE_INFO } from '../game/roles';

export type EndReason =
  | 'quests_evil'           // 퀘스트 3회 실패
  | 'rejection'             // 5연속 부결
  | 'assassination_success' // 암살 성공 (멀린 지목)
  | 'assassination_failed'; // 암살 실패

export interface SaveGameOptions {
  room: GameState;
  winner: 'good' | 'evil';
  endReason: EndReason;
}

// ── 게임 저장 ──────────────────────────────────────────────

const insertGame = db.prepare<{
  guild_id: string;
  channel_id: string;
  winner: string;
  end_reason: string;
  player_count: number;
  quest_results: string;
  ended_at: number;
}>(`
  INSERT INTO games (guild_id, channel_id, winner, end_reason, player_count, quest_results, ended_at)
  VALUES (@guild_id, @channel_id, @winner, @end_reason, @player_count, @quest_results, @ended_at)
`);

const insertPlayer = db.prepare<{
  game_id: number;
  user_id: string;
  role: string;
  alignment: string;
}>(`
  INSERT INTO game_players (game_id, user_id, role, alignment)
  VALUES (@game_id, @user_id, @role, @alignment)
`);

export function saveGame({ room, winner, endReason }: SaveGameOptions): number {
  const result = db.transaction(() => {
    const { lastInsertRowid } = insertGame.run({
      guild_id: room.guildId,
      channel_id: room.channelId,
      winner,
      end_reason: endReason,
      player_count: room.players.length,
      quest_results: JSON.stringify(room.questResults),
      ended_at: Date.now(),
    });

    const gameId = Number(lastInsertRowid);

    for (const player of room.players) {
      const role = room.roles.get(player.id);
      if (!role) continue;
      insertPlayer.run({
        game_id: gameId,
        user_id: player.id,
        role,
        alignment: ROLE_INFO[role].alignment,
      });
    }

    return gameId;
  })();

  return result as number;
}

// ── 서버 게임 기록 조회 ──────────────────────────────────

export interface GameRecord {
  id: number;
  winner: 'good' | 'evil';
  end_reason: EndReason;
  player_count: number;
  quest_results: string; // JSON
  ended_at: number;
}

const selectGuildHistory = db.prepare<{ guild_id: string; limit: number }>(`
  SELECT id, winner, end_reason, player_count, quest_results, ended_at
  FROM games
  WHERE guild_id = @guild_id
  ORDER BY ended_at DESC
  LIMIT @limit
`);

export function getGuildHistory(guildId: string, limit = 10): GameRecord[] {
  return selectGuildHistory.all({ guild_id: guildId, limit }) as GameRecord[];
}

// ── 유저 통계 조회 ──────────────────────────────────────

export interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  roleBreakdown: { role: string; games: number; wins: number }[];
}

const selectUserGames = db.prepare<{ user_id: string; guild_id: string }>(`
  SELECT g.winner, gp.role, gp.alignment
  FROM game_players gp
  JOIN games g ON g.id = gp.game_id
  WHERE gp.user_id = @user_id
    AND g.guild_id = @guild_id
`);

export function getUserStats(userId: string, guildId: string): UserStats {
  const rows = selectUserGames.all({ user_id: userId, guild_id: guildId }) as {
    winner: 'good' | 'evil';
    role: string;
    alignment: 'good' | 'evil';
  }[];

  const roleMap = new Map<string, { games: number; wins: number }>();
  let wins = 0;

  for (const row of rows) {
    const isWin = row.winner === row.alignment;
    if (isWin) wins++;

    const entry = roleMap.get(row.role) ?? { games: 0, wins: 0 };
    entry.games++;
    if (isWin) entry.wins++;
    roleMap.set(row.role, entry);
  }

  const roleBreakdown = [...roleMap.entries()]
    .map(([role, stat]) => ({ role, ...stat }))
    .sort((a, b) => b.games - a.games);

  return {
    totalGames: rows.length,
    wins,
    losses: rows.length - wins,
    roleBreakdown,
  };
}
