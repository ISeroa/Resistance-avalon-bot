# 🧠 Avalon Bot Design Document

---

## 1. 상태머신 (GamePhase)

```
waiting → proposal → team_vote → quest_vote → proposal (다음 라운드)
                                             → assassination (선 3승)
                                             → finished (악 3승 or 5연속 부결)
assassination → finished
```

| phase | 설명 |
|-------|------|
| `waiting` | 로비 대기 중 |
| `proposal` | 리더가 팀 제안 |
| `team_vote` | 전원 찬반 투표 |
| `quest_vote` | 팀원만 DM 투표 |
| `assassination` | 암살자가 멀린 지목 |
| `finished` | 게임 종료 |

---

## 2. GameState 데이터 모델

```ts
interface GameState {
  guildId: string
  channelId: string
  hostUserId: string
  phase: GamePhase
  players: Player[]          // { id, username }[]
  createdAt: Date

  roles: Map<string, RoleName>        // 절대 채널 출력 금지
  round: number                       // 1~5
  leaderIndex: number                 // players 배열 인덱스
  proposalNumber: number              // 현재 라운드 제안 횟수 (5회 부결 → 악 승)
  questResults: QuestResult[]         // 'success' | 'fail'
  currentTeam: string[]               // 현재 제안된 팀 userId[]
  teamVotes: Record<string, boolean>  // true=찬성
  questVotes: Record<string, boolean> // true=성공 — 절대 채널 출력 금지
  restartVotes: Record<string, boolean>
}
```

---

## 3. 역할 지식 규칙

| 역할 | 알 수 있는 정보 |
|------|----------------|
| Merlin | 악(Mordred 제외) 전체 |
| Percival | Merlin + Morgana (구분 불가) |
| Assassin / Morgana / Mordred / Minion | 악 동료 (Oberon 제외) |
| Oberon | 없음 (동료에게도 숨겨짐) |
| LoyalServant | 없음 |

---

## 4. 퀘스트 팀 크기 (인원수별)

| 인원 | R1 | R2 | R3 | R4 | R5 |
|------|----|----|----|----|-----|
| 5    | 2  | 3  | 2  | 3  | 3  |
| 6    | 2  | 3  | 4  | 3  | 4  |
| 7    | 2  | 3  | 3  | 4* | 4  |
| 8    | 3  | 4  | 4  | 5* | 5  |
| 9    | 3  | 4  | 4  | 5* | 5  |
| 10   | 3  | 4  | 4  | 5* | 5  |

`*` = 실패 2표 이상이어야 퀘스트 실패 (7인 이상 R4)

---

## 5. 승리 판정 (questConfig.ts)

- `checkWinCondition(questResults)` → `'evil_wins' | 'good_wins_assassination' | null`
- 실패 3회 → `evil_wins`
- 성공 3회 → `good_wins_assassination`
- 그 외 → `null` (진행 중)

---

## 6. 타임아웃 (timerManager.ts)

- 팀 구성 통과 시 5분 타이머 시작
- 전원 투표 완료 시 타이머 취소
- 5분 경과 시 미투표자 → `true`(성공) 자동 처리 후 결과 집계
- 게임 재시작 시 타이머 취소

---

## 7. DB 스키마 (data/avalon.db)

```sql
games (
  id           INTEGER PK,
  guild_id     TEXT,
  channel_id   TEXT,
  winner       TEXT,      -- 'good' | 'evil'
  end_reason   TEXT,      -- 'quests_evil' | 'rejection' | 'assassination_success' | 'assassination_failed'
  player_count INTEGER,
  quest_results TEXT,     -- JSON: ['success','fail',...]
  ended_at     INTEGER    -- Unix ms
)

game_players (
  id        INTEGER PK,
  game_id   INTEGER FK → games.id,
  user_id   TEXT,
  role      TEXT,
  alignment TEXT          -- 'good' | 'evil'
)
```

---

## 8. 보안 원칙

- `roles`, `questVotes`는 절대 공개 채널/콘솔 출력 금지
- 모든 버튼/커맨드 처리 시 검증 순서:
  1. phase가 맞는가?
  2. 방 참가자인가?
  3. 권한이 있는가? (리더, 암살자 등)
  4. 중복 입력인가?

---

## 9. 버튼 customId 규칙

| customId | 설명 |
|----------|------|
| `team_approve` / `team_reject` | 팀 투표 (채널) |
| `quest_success:{guildId}:{channelId}` | 퀘스트 성공 (DM) |
| `quest_fail:{guildId}:{channelId}` | 퀘스트 실패 (DM) |
| `restart_yes` / `restart_no` | 재시작 투표 (채널) |
