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
| `team_approve:{guildId}:{channelId}` | 팀 투표 찬성 (채널) |
| `team_reject:{guildId}:{channelId}` | 팀 투표 반대 (채널) |
| `quest_success:{guildId}:{channelId}` | 퀘스트 성공 (DM) |
| `quest_fail:{guildId}:{channelId}` | 퀘스트 실패 (DM) |
| `restart_yes:{guildId}:{channelId}` | 재시작 찬성 (채널) |
| `restart_no:{guildId}:{channelId}` | 재시작 반대 (채널) |

모든 버튼 핸들러는 customId의 guildId·channelId와 interaction의 guildId·channelId를 교차 검증하여 다른 채널/DM에서 온 잘못된 요청을 차단한다.

---

## 10. 안정성 및 동시성 설계

### isTransitioning 플래그

Node.js 단일 스레드 모델에서도 `await` 구간 사이에 두 핸들러가 교차 실행될 수 있다.
이를 방지하기 위해 `GameState.isTransitioning` 플래그를 사용한다.

| 설정 (`true`) | 해제 (`false`) |
|---|---|
| `handleTeamVoteButton` 전원 투표 결과 처리 진입 | `toQuestVote` |
| `resolveQuest` 진입 | `toNextRound` |
| | `toProposalAfterRejection` |
| | `toAssassination` |
| | `performRestart` |

`toFinished`는 게임이 종료되므로 해제 불필요.

### activeTeamVoteMessageId

팀 투표 메시지 생성 시 ID를 저장하고, 버튼 클릭 시 현재 메시지 ID와 비교한다.
과거 팀 투표 메시지의 버튼이 새 투표에 영향을 주지 못하도록 차단한다.

### clearQuestTimer 보장

`toFinished()` 내부에서 `clearQuestTimer`를 직접 호출하므로,
호출 경로와 무관하게 게임 종료 시 타이머가 반드시 정리된다.

---

## 11. 단계별 커맨드 접근

각 서브커맨드가 허용되는 phase. ✅ = 허용, ❌ = 차단.

| 커맨드 | waiting | proposal | team_vote | quest_vote | assassination | finished | 비고 |
|--------|:-------:|:--------:|:---------:|:----------:|:-------------:|:--------:|------|
| `ping` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `create` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 방이 없을 때만 가능 (phase 무관) |
| `join` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| `leave` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | |
| `status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `cancel` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | 방장 전용 |
| `start` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 방장 전용, 최소 5명 |
| `propose` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | 현재 리더 전용 |
| `assassinate` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 암살자 전용 |
| `restart` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | 참가자 전용, 중복 불가 |
| `history` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `stats` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |

> `leave` / `cancel`은 게임 진행 중(`proposal`~`assassination`) 차단되며, 재시작하려면 `/avalon restart`를 사용해야 한다.

---

## 12. 단계 전환별 필드 리셋 보장

각 전환 함수(`transitions.ts`)가 초기화하는 GameState 필드.

| 전환 | `proposalNumber` | `teamVotes` | `questVotes` | `currentTeam` | `activeTeamVoteMessageId` | `isTransitioning` |
|------|:----------------:|:-----------:|:------------:|:-------------:|:-------------------------:|:-----------------:|
| `proposal → team_vote` (`handleProposeMenu`) | — | ✅ 초기화 | — | ✅ 저장 | ✅ 저장 | — |
| `team_vote → quest_vote` (`toQuestVote`) | — | ✅ 초기화 | ✅ 초기화 | — | ✅ null | ✅ false |
| `team_vote → proposal` 부결 (`toProposalAfterRejection`) | ✅ +1 | ✅ 초기화 | — | ✅ 초기화 | ✅ null | ✅ false |
| `quest_vote → proposal` 다음 라운드 (`toNextRound`) | ✅ =0 | ✅ 초기화 | ✅ 초기화 | ✅ 초기화 | ✅ null | ✅ false |
| `quest_vote → assassination` (`toAssassination`) | — | ✅ 초기화 | ✅ 초기화 | ✅ 초기화 | ✅ null | ✅ false |
| 재시작 (`performRestart`) | ✅ =0 | ✅ 초기화 | ✅ 초기화 | ✅ 초기화 | ✅ null | ✅ false |

> `toFinished`는 게임이 종료되므로 `isTransitioning` 해제 및 필드 초기화 불필요.
