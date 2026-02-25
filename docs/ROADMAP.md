# 🚀 Development Roadmap

---

## Phase 1 - Core Skeleton ✅
- [x] TypeScript + Discord.js 세팅
- [x] 슬래시 커맨드 deploy 스크립트
- [x] `/avalon ping` 테스트

---

## Phase 2 - Lobby ✅
- [x] `create` — 방 생성, 중복 방 체크
- [x] `join` — 참가, 중복 참가 체크
- [x] `leave` — 나가기, 방장 나가면 방 해체
- [x] `status` — 현재 방 상태 embed
- [x] `cancel` — 방 강제 취소 (방장 전용)

---

## Phase 3 - Game Start ✅
- [x] 인원 검증 (최소 5명)
- [x] 역할 배정 (5~10인 테이블)
- [x] 역할 DM 병렬 발송 (DM 실패 시 경고)
- [x] 초기 리더 랜덤 지정

---

## Phase 4 - Proposal & Team Vote ✅
- [x] `/avalon propose` — 라운드별 팀 크기 검증
- [x] 팀 투표 버튼 (찬성/반대)
- [x] 5연속 부결 → 악 승리
- [x] 부결 시 리더 교체, 제안 횟수 표시

---

## Phase 5 - Quest Vote ✅
- [x] 퀘스트 투표 DM 버튼 (선: 성공만 / 악: 성공+실패)
- [x] 실패표 집계, 7인 이상 R4 2패 규칙
- [x] 퀘스트 3회 실패 → 악 승리
- [x] 퀘스트 3회 성공 → 암살 단계 진입
- [x] 퀘스트 투표 타임아웃 5분 (미투표 → 성공 자동처리)

---

## Phase 6 - Assassination ✅
- [x] `/avalon assassinate target:@user`
- [x] 암살자 권한 검증
- [x] 암살 성공/실패 판정 및 전원 역할 공개

---

## Phase 7 - Bug Fixes & QoL ✅
- [x] 게임 진행 중 leave/cancel 차단
- [x] status에 퀘스트 기록 표시
- [x] `/avalon restart` — 재시작 투표 (과반 찬성 시 새 게임)
- [x] 과거 팀 투표 버튼 차단 (`activeTeamVoteMessageId`)
- [x] 버튼 customId에 `:{guildId}:{channelId}` 포함, 교차 검증으로 유령 interaction 차단
- [x] 동시 입력 경쟁 조건 방어 (`isTransitioning` lock — team_vote·quest_vote 모두 적용)
- [x] 퀘스트 타이머 누수 방지 (`toFinished` 내부 자동 정리, 모든 종료 경로 커버)
- [x] DM 실패 시 채널 대체 버튼 전송
- [x] 봇 재시작 후 stale interaction 안내 메시지
- [x] `handleProposeMenu` null window 제거 — `room.phase='team_vote'`를 `voteMsg.id` 저장 직후로 이동, send 실패 시 proposal 롤백
- [x] `handleTeamVoteButton` progress edit 역전 방지 — `await reply()` 이후 phase·messageId 가드 추가, 결과 embed 덮어쓰기 차단
- [x] `handleTeamVoteButton` `isTransitioning` 미해제 수정 — try/finally로 5연속 부결→finished 경로 포함 전 경로 lock 해제 보장
- [x] `resolveQuest`/`performRestart` 교차 실행 방지 — `questSessionId` 카운터 도입, restart 시 increment로 진행 중인 resolveQuest 무효화
- [x] DESIGN.md 섹션 11·12 추가 — 단계별 커맨드 접근 표, 단계 전환별 필드 리셋 보장 표

---

## Phase 8 - Game History (SQLite) ✅
- [x] `better-sqlite3` 도입
- [x] 게임 종료 4케이스 모두 DB 저장
- [x] `/avalon history` — 서버 최근 10게임
- [x] `/avalon stats [user]` — 승률 및 역할별 전적

---

## Phase 9 - 운영 정비 ✅
- [x] 슬래시 커맨드 글로벌 등록으로 전환
- [x] 길드 커맨드 제거
- [x] `.gitignore` — data/, .claude/ 추가

---

## Phase 10 - Rules & Test 정비 ✅
- [x] `/avalon rules [type]` — 기본 규칙·역할 소개·승리 조건 조회 (ephemeral embed)
  - `type` 옵션: `basic`(기본값) / `roles` / `win`
  - 방 조회 없음, 어떤 phase에서도 DM에서도 사용 가능
- [x] `src/game/rules.ts` 신규 — `BASIC_RULES` / `ROLE_RULES` / `WIN_RULES` 문자열 상수 분리
  - embed description으로 바로 사용 가능한 포맷
  - `avalon.ts`에서 `RULES_META`로 title·color·description 매핑 후 `EmbedBuilder` 조립
- [x] `vitest.config.ts` 신규 — `include: ['src/**/*.test.ts']` 명시
  - `dist/__tests__/*.js` 중복 스캔 제거, 테스트 실행 시간 3.09s → 1.17s 개선
- [x] DESIGN.md 섹션 11 갱신 — `rules` 커맨드 행 추가

---

## 향후 확장 아이디어
- [ ] 진행 중 게임 상태 DB 저장 (봇 재시작 복구)
- [ ] 라운드별 상세 기록 저장 (팀 구성, 투표 결과)
- [ ] 서버별 리더보드
- [ ] 웹 대시보드 연동
