# 🧠 Avalon Bot Design Document

---

## 1. 상태머신 설계

GameState:

- IDLE
- LOBBY
- ASSIGN_ROLES
- PROPOSAL
- TEAM_VOTE
- QUEST_VOTE
- RESOLVE_QUEST
- ASSASSINATION
- END

---

## 2. GameRoom 데이터 모델

```ts
interface GameRoom {
  guildId: string
  channelId: string
  hostUserId: string
  state: GameState
  players: Player[]
  roles: Record<string, Role>
  round: number
  leaderIndex: number
  proposalNumber: number
  questResults: ("SUCCESS" | "FAIL")[]
  currentTeam: string[]
  teamVotes: Record<string, "APPROVE" | "REJECT">
  questVotes: Record<string, "SUCCESS" | "FAIL">
}

---

## 3. 보안 설계

- roles는 public log에 기록하지 않는다

- questVotes 원본은 공개하지 않는다

- console.log에 비밀 정보 출력 금지

---

## 4. Interaction 검증 규칙

모든 버튼/셀렉트 처리 시:

1. state가 맞는가?

2. 참가자인가?

3. 권한이 있는가?

4. 중복 입력인가?

5. round mismatch인가?

## 5. 승리 조건
- 실패 3 → 악 승
- 성공 3 → 암살 단계
- 암살 성공 → 악 승
- 암살 실패 → 선 승
- 5연속 부결 → 악 승