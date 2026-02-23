# 🎭 Resistance: Avalon Discord Bot

Discord.js v14 + TypeScript 기반의  
레지스탕스: 아발론(Resistance: Avalon) 게임 봇 프로젝트.

---

## 🎯 프로젝트 목표

- 디스코드 서버에서 아발론 1판을 완전히 진행 가능한 봇 구현
- Slash Command + 버튼 + Select Menu 기반 UI
- 비밀 정보는 DM으로 전달
- 메모리 기반 상태 저장 (MVP 단계)
- 확장 가능 구조 설계 (향후 시크릿 히틀러 확장 가능)

---

## 📦 기술 스택

- Node.js 18+
- TypeScript (strict mode)
- discord.js v14
- dotenv

---

## 🚀 MVP 범위

### 포함
- 5~10인 플레이
- 역할 배정 (Merlin / Assassin / Loyal / Minion)
- 퀘스트 진행
- 5연속 부결 악승 처리
- 7인 이상 Quest4 2패 규칙
- 암살 단계

### 제외 (후속 확장)
- Mordred / Oberon / Morgana
- 통계 시스템
- 멀티룸
- DB 영속성

---

## 🧠 설계 원칙

1. 전역 단일 게임 객체 사용 금지
2. guildId + channelId 기준 GameRoom Map 관리
3. 모든 interaction은 state 검증 필수
4. 비밀 정보는 절대 공개 채널 출력 금지
5. TypeScript strict 모드 유지

---

## 🗂 프로젝트 구조
```text
src/
├── index.ts
├── bot.ts
├── commands/
│   └── avalon.ts
├── game/
│   ├── GameRoom.ts
│   ├── GameState.ts
│   ├── Role.ts
│   ├── teamSizeTable.ts
│   └── gameManager.ts
├── interactions/
│   ├── proposal.ts
│   ├── teamVote.ts
│   ├── questVote.ts
│   └── assassination.ts
└── utils/
    └── helpers.ts
```
---

## 🔧 실행 방법

```bash
npm install
npm run deploy-commands
npm run dev

🪜 개발 전략

이 프로젝트는 “기능을 단계적으로 쪼개서” 구현한다.

1. 스켈레톤 + ping 커맨드

2. Lobby 시스템

3. 역할 배정 + DM 체크

4. Proposal

5. Team Vote

6. Quest Vote

7. Assassination
