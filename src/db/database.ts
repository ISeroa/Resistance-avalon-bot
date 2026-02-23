import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db: DatabaseType = new Database(path.join(dataDir, 'avalon.db'));

// WAL 모드로 읽기 성능 향상
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT    NOT NULL,
    channel_id  TEXT    NOT NULL,
    winner      TEXT    NOT NULL,  -- 'good' | 'evil'
    end_reason  TEXT    NOT NULL,  -- 'quests_evil' | 'rejection' | 'assassination_success' | 'assassination_failed'
    player_count INTEGER NOT NULL,
    quest_results TEXT  NOT NULL,  -- JSON: ['success','fail',...]
    ended_at    INTEGER NOT NULL   -- Unix timestamp (ms)
  );

  CREATE TABLE IF NOT EXISTS game_players (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id   INTEGER NOT NULL REFERENCES games(id),
    user_id   TEXT    NOT NULL,
    role      TEXT    NOT NULL,
    alignment TEXT    NOT NULL  -- 'good' | 'evil'
  );

  CREATE INDEX IF NOT EXISTS idx_games_guild    ON games(guild_id);
  CREATE INDEX IF NOT EXISTS idx_games_ended    ON games(ended_at DESC);
  CREATE INDEX IF NOT EXISTS idx_players_user   ON game_players(user_id);
  CREATE INDEX IF NOT EXISTS idx_players_game   ON game_players(game_id);
`);
