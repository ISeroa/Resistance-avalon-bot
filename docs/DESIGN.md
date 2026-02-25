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

  // Auto-cancel (무조작 방 자동 정리)
  lastActivityAt: number                              // 마지막 사용자 조작 시각 (Unix ms)
  cleanupTimer: ReturnType<typeof setTimeout> | null  // 방 자동 정리 타이머 핸들
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

### 퀘스트 투표 타임아웃 (Quest Timer)

- 팀 구성 통과 시 5분 타이머 시작
- 전원 투표 완료 시 타이머 취소
- 5분 경과 시 미투표자 → `true`(성공) 자동 처리 후 결과 집계
- 게임 재시작 시 타이머 취소
- 구현: `questTimers: Map<roomKey, Timeout>` (guildId+channelId 키)

### 방 자동 정리 타임아웃 (Cleanup Timer)

- 구현: `GameState.cleanupTimer` 필드에 직접 저장 (별도 Map 불필요)
- phase별 타임아웃:

| phase | 타임아웃 | 상수 |
|-------|---------|------|
| `waiting` | 10분 | `LOBBY_CLEANUP_MS` |
| `finished` | 3분 | `FINISHED_CLEANUP_MS` |
| 그 외 (진행 중) | 없음 | — |

- `clearCleanupTimer(room)`: `room.cleanupTimer`를 clearTimeout 후 null로 초기화
- `deleteRoom()` 내부에서 자동 호출되므로 수동 삭제 시에도 타이머가 누수되지 않음

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
| | `handleTeamVoteButton` try/finally (모든 경로 보장) |

`toFinished`를 포함한 모든 경로는 `handleTeamVoteButton`의 try/finally가 최종 해제를 보장한다.

### activeTeamVoteMessageId

팀 투표 메시지 생성 시 ID를 저장하고, 버튼 클릭 시 현재 메시지 ID와 비교한다.
과거 팀 투표 메시지의 버튼이 새 투표에 영향을 주지 못하도록 차단한다.

### clearQuestTimer 보장

`toFinished()` 내부에서 `clearQuestTimer`를 직접 호출하므로,
호출 경로와 무관하게 게임 종료 시 타이머가 반드시 정리된다.

### questSessionId

`performRestart`와 `resolveQuest`의 교차 실행을 방지하기 위한 세션 카운터.

| increment 시점 | 위치 |
|---|---|
| 새 퀘스트 세션 시작 | `toQuestVote(room)` 직후 (`handleTeamVoteButton`) |
| 게임 재시작 | `performRestart` 첫 `await` 이전 |

`resolveQuest`는 진입 시 `sid = room.questSessionId`를 캡처하고,
첫 `await`(`channel.fetch`) 이후 `sid !== room.questSessionId`이면 즉시 return한다.
이로써 restart가 진행 중인 resolveQuest를 무효화하고, 구 퀘스트 결과 embed가
재시작 embed 이후 채널에 출력되는 현상을 방지한다.

---

## 11. 무조작 방 자동 정리 (Auto-cancel)

### 정책

| phase | 조건 | 동작 |
|-------|------|------|
| `waiting` | 10분 무조작 | 방 삭제 + 채널 안내 메시지 |
| `finished` | 3분 무조작 | 방 삭제 + 채널 안내 메시지 |
| 진행 중 (`proposal`~`assassination`) | — | 자동 정리 없음 |

### "조작(activity)"의 정의

다음 세 종류의 interaction이 activity로 인정된다. 봇이 자체적으로 상태를 전환하며 메시지를 출력하는 것은 **activity로 취급하지 않는다**.

- Slash command 실행
- Button interaction
- SelectMenu interaction (UserSelectMenu 포함)

### 데이터 흐름

```
사용자 조작 (slash / button / select)
  → router.handleInteraction()
      → [핸들러 실행 — 상태 전환 완료]
      → tryMarkActivity()
          → markActivity(room, client)          ← lastActivityAt 갱신
              → ensureCleanupTimer(room, client) ← 현재 phase 기준 타이머 재설정

bot-triggered 전환 (quest 타임아웃 콜백 등, router 미경유)
  → resolveQuest() 내 상태 전환 후
      → ensureCleanupTimer(room, client)        ← 직접 호출
```

### 타이머 단일성 보장

`ensureCleanupTimer`는 첫 줄에서 `clearCleanupTimer(room)`을 **항상** 호출한다.
따라서 몇 번을 연속 호출해도 `room.cleanupTimer`에는 최대 1개의 타이머만 존재한다.

### 자동 정리 콜백 안전 조건

타이머가 발화할 때 아래 조건 중 하나라도 해당하면 삭제를 취소한다.

1. `getRoom(guildId, channelId)` → `undefined` (이미 수동 삭제됨)
2. `room.phase`가 진행 중 phase로 변경됨 (게임이 시작됨)

### 관련 파일

| 파일 | 역할 |
|------|------|
| `game/timerManager.ts` | `LOBBY_CLEANUP_MS`, `FINISHED_CLEANUP_MS`, `clearCleanupTimer(room)` |
| `game/activity.ts` | `ensureCleanupTimer(room, client)`, `markActivity(room, client)` |
| `interactions/router.ts` | `tryMarkActivity()` — 모든 interaction 후 호출 |
| `interactions/buttonHandlers.ts` | `resolveQuest` 내 bot-triggered 전환 후 `ensureCleanupTimer` 직접 호출 |

---

## 12. 단계별 커맨드 접근

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
| `rules` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 방 조회 없음, DM에서도 사용 가능 |

> `leave` / `cancel`은 게임 진행 중(`proposal`~`assassination`) 차단되며, 재시작하려면 `/avalon restart`를 사용해야 한다.

---

## 13. 단계 전환별 필드 리셋 보장

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
