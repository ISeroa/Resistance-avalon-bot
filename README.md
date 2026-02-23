# 🎭 Resistance: Avalon Discord Bot

Discord.js v14 + TypeScript 기반의
레지스탕스: 아발론(Resistance: Avalon) 게임 봇 프로젝트.

---

## 🎯 프로젝트 목표

- 디스코드 서버에서 아발론 1판을 완전히 진행 가능한 봇 구현
- Slash Command + 버튼 기반 UI
- 비밀 정보(역할, 퀘스트 투표)는 DM으로 전달
- 메모리 기반 게임 상태 + SQLite 기록 영속성
- 확장 가능 구조 설계

---

## 📦 기술 스택

- Node.js 18+
- TypeScript (strict mode)
- discord.js v14
- better-sqlite3
- dotenv
- vitest (테스트)

---

## ✅ 구현 완료 기능

### 로비
- `/avalon create` — 방 생성
- `/avalon join` — 참가
- `/avalon leave` — 나가기 (게임 진행 중 차단)
- `/avalon status` — 방 상태 확인
- `/avalon cancel` — 방 취소 (방장 전용, 게임 진행 중 차단)

### 게임 진행
- `/avalon start` — 게임 시작 (방장 전용, 최소 5명), 역할 DM 발송
- `/avalon propose` — 퀘스트 팀 제안 (리더 전용)
  - 리더에게 에페머럴 `UserSelectMenu` 표시 (Discord UI에서 팀 크기 강제)
  - 리더 호출 시 채널에 공개 알림 ("👑 X님이 팀원 선택 중...")
- 팀 투표 — 채널 버튼 (찬성/반대), 부결 시 새 채널 메시지로 다음 리더 공지
- 5연속 부결 시 악 승리
- 퀘스트 투표 — DM 버튼 (성공/실패), 5분 타임아웃 (미투표 → 성공 처리)
- `/avalon assassinate` — 멀린 암살 (암살자 전용)
- `/avalon restart` — 재시작 투표 (과반 찬성 시 새 게임)

### 기록
- `/avalon history` — 이 서버의 최근 10게임 목록
- `/avalon stats [user]` — 플레이어 승률 및 역할별 전적

---

## 🎮 지원 인원 및 역할

| 인원 | 선 | 악 | 역할 구성 |
|------|----|----|-----------|
| 5명  | 3  | 2  | Merlin, Percival, Loyal / Assassin, Morgana |
| 6명  | 4  | 2  | Merlin, Percival, Loyal×2 / Assassin, Morgana |
| 7명  | 4  | 3  | Merlin, Percival, Loyal×2 / Assassin, Morgana, Oberon |
| 8명  | 5  | 3  | Merlin, Percival, Loyal×3 / Assassin, Morgana, Minion |
| 9명  | 6  | 3  | Merlin, Percival, Loyal×4 / Assassin, Morgana, Mordred |
| 10명 | 6  | 4  | Merlin, Percival, Loyal×4 / Assassin, Morgana, Mordred, Oberon |

---

## 💀 승리 조건

| 조건 | 승자 |
|------|------|
| 퀘스트 3회 실패 | 악 |
| 5연속 부결 | 악 |
| 퀘스트 3번 성공 후 암살 성공 | 악 |
| 퀘스트 3번 성공 후 암살 실패 | 선 |

---

## 🧠 설계 원칙

1. guildId + channelId 기준 GameRoom Map 관리 (멀티룸 지원)
2. 모든 interaction은 phase·권한·중복·세션(customId ↔ guildId/channelId 교차검증) 검증 필수
3. 비밀 정보(roles, questVotes)는 절대 공개 채널/콘솔 출력 금지
4. `isTransitioning` + `activeTeamVoteMessageId`로 동시 입력 경쟁 조건 방어
5. 순수 함수 분리 → vitest 단위 테스트
6. TypeScript strict 모드 유지

---

## 🗂 프로젝트 구조

```text
src/
├── index.ts
├── bot.ts
├── deploy-commands.ts
├── commands/
│   └── avalon.ts          # 모든 슬래시 커맨드 핸들러
├── game/
│   ├── GameState.ts       # 상태 타입 및 createGameState()
│   ├── gameManager.ts     # 룸 Map 관리
│   ├── roles.ts           # 역할 배정, DM 메시지 생성
│   ├── questConfig.ts     # 팀 크기, 퀘스트 실패 조건, 승리 판정
│   └── timerManager.ts    # 퀘스트 투표 타임아웃 (5분)
├── interactions/
│   ├── router.ts          # slash/button 분기
│   └── buttonHandlers.ts  # 팀투표·퀘스트투표·재시작투표 처리
├── db/
│   ├── database.ts        # SQLite 초기화 (data/avalon.db)
│   └── gameHistory.ts     # saveGame(), getGuildHistory(), getUserStats()
└── utils/
    └── helpers.ts
```

---

## 🔧 실행 방법

```bash
# 최초 설정
npm install
cp .env.example .env   # DISCORD_TOKEN, DISCORD_CLIENT_ID 입력

# 슬래시 커맨드 등록 (구조 변경 시에만)
npm run deploy-commands

# 개발
npm run dev

# 테스트
npm test

# 프로덕션
npm run build
npm run start          # 또는 pm2 start dist/index.js --name avalon-bot
```

---

## 🔑 환경 변수 (.env)

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
```
