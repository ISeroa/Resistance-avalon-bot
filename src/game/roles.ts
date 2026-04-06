export type RoleName =
  | 'Merlin'
  | 'Percival'
  | 'LoyalServant' // 아서의 충신 (일반 선)
  | 'Assassin'
  | 'Morgana'
  | 'Mordred'
  | 'Oberon'
  | 'Minion'; // 모드레드의 부하 (일반 악)

// ── RoleConfig (방별 역할 설정, MVP 범위: Merlin/Assassin/LoyalServant/Minion) ──

export type RoleConfig = {
  merlin: number;
  assassin: number;
  loyal: number;  // LoyalServant 수
  minion: number; // Minion 수
};

/** 인원수별 기본 역할 설정 (5~10인). 원본 수정 방지를 위해 Readonly. */
export const DEFAULT_ROLE_TABLE: Readonly<Record<number, Readonly<RoleConfig>>> = {
  5:  { merlin: 1, assassin: 1, loyal: 2, minion: 1 },
  6:  { merlin: 1, assassin: 1, loyal: 3, minion: 1 },
  7:  { merlin: 1, assassin: 1, loyal: 3, minion: 2 },
  8:  { merlin: 1, assassin: 1, loyal: 4, minion: 2 },
  9:  { merlin: 1, assassin: 1, loyal: 5, minion: 2 },
  10: { merlin: 1, assassin: 1, loyal: 6, minion: 2 },
};

/**
 * 인원수에 맞는 기본 RoleConfig 복사본을 반환한다.
 * 반환값은 원본 테이블과 독립된 복사본이므로 직접 수정해도 안전하다.
 */
export function getDefaultRoleConfig(playerCount: number): RoleConfig {
  const cfg = DEFAULT_ROLE_TABLE[playerCount];
  if (!cfg) throw new Error(`지원하지 않는 인원수: ${playerCount}`);
  return { ...cfg };
}

/**
 * RoleConfig 유효성 검증.
 * @returns 오류 메시지(string) 또는 유효하면 null
 */
export function validateRoleConfig(config: RoleConfig, playerCount: number): string | null {
  const total = config.merlin + config.assassin + config.loyal + config.minion;
  if (total !== playerCount) {
    return `역할 총합(${total})이 현재 플레이어 수(${playerCount})와 일치하지 않습니다.`;
  }
  if (config.merlin !== 1) return '멀린은 정확히 1명이어야 합니다.';
  if (config.assassin !== 1) return '암살자는 정확히 1명이어야 합니다.';
  if (config.loyal < 0) return '아서의 충신 수는 0 이상이어야 합니다.';
  if (config.minion < 0) return '모드레드의 부하 수는 0 이상이어야 합니다.';
  return null;
}

/** RoleConfig를 기반으로 역할 풀(Role[])을 생성한다. */
export function buildRolePool(config: RoleConfig): RoleName[] {
  const pool: RoleName[] = [];
  for (let i = 0; i < config.merlin; i++) pool.push('Merlin');
  for (let i = 0; i < config.assassin; i++) pool.push('Assassin');
  for (let i = 0; i < config.loyal; i++) pool.push('LoyalServant');
  for (let i = 0; i < config.minion; i++) pool.push('Minion');
  return pool;
}

/** RoleConfig 기반으로 역할을 무작위 배정한다. */
export function assignRolesFromConfig(playerIds: string[], config: RoleConfig): Map<string, RoleName> {
  const shuffled = shuffle(buildRolePool(config));
  const result = new Map<string, RoleName>();
  playerIds.forEach((id, i) => result.set(id, shuffled[i]!));
  return result;
}

export type Alignment = 'good' | 'evil';

export interface RoleInfo {
  displayName: string;
  alignment: Alignment;
  emoji: string;
}

export const ROLE_INFO: Record<RoleName, RoleInfo> = {
  Merlin:       { displayName: '멀린',          alignment: 'good', emoji: '🔮' },
  Percival:     { displayName: '퍼시벌',         alignment: 'good', emoji: '🛡️' },
  LoyalServant: { displayName: '아서의 충신',    alignment: 'good', emoji: '⚔️' },
  Assassin:     { displayName: '암살자',         alignment: 'evil', emoji: '🗡️' },
  Morgana:      { displayName: '모르가나',        alignment: 'evil', emoji: '🌙' },
  Mordred:      { displayName: '모드레드',        alignment: 'evil', emoji: '💀' },
  Oberon:       { displayName: '오베론',          alignment: 'evil', emoji: '👁️' },
  Minion:       { displayName: '모드레드의 부하', alignment: 'evil', emoji: '🔱' },
};

// 인원수별 역할 구성 (5~10명)
const ROLE_TABLES: Readonly<Record<number, RoleName[]>> = {
  5:  ['Merlin', 'Percival', 'LoyalServant', 'Assassin', 'Morgana'],
  6:  ['Merlin', 'Percival', 'LoyalServant', 'LoyalServant', 'Assassin', 'Morgana'],
  7:  ['Merlin', 'Percival', 'LoyalServant', 'LoyalServant', 'Assassin', 'Morgana', 'Oberon'],
  8:  ['Merlin', 'Percival', 'LoyalServant', 'LoyalServant', 'LoyalServant', 'Assassin', 'Morgana', 'Minion'],
  9:  ['Merlin', 'Percival', 'LoyalServant', 'LoyalServant', 'LoyalServant', 'LoyalServant', 'Assassin', 'Morgana', 'Mordred'],
  10: ['Merlin', 'Percival', 'LoyalServant', 'LoyalServant', 'LoyalServant', 'LoyalServant', 'Assassin', 'Morgana', 'Mordred', 'Oberon'],
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** roles 맵에서 암살자의 userId를 반환한다. */
export function getAssassinId(roles: Map<string, RoleName>): string | undefined {
  return [...roles.entries()].find(([, r]) => r === 'Assassin')?.[0];
}

/** roles 맵에서 멀린의 userId를 반환한다. */
export function getMerlinId(roles: Map<string, RoleName>): string | undefined {
  return [...roles.entries()].find(([, r]) => r === 'Merlin')?.[0];
}

/**
 * playerIds 순서대로 역할을 무작위 배정한다.
 */
export function assignRoles(playerIds: string[], count: number): Map<string, RoleName> {
  const roleList = ROLE_TABLES[count];
  if (!roleList) throw new Error(`지원하지 않는 인원수: ${count}`);

  const shuffled = shuffle(roleList);
  const result = new Map<string, RoleName>();
  playerIds.forEach((id, i) => result.set(id, shuffled[i]!));
  return result;
}

/**
 * 플레이어에게 보낼 DM 메시지를 생성한다.
 * allRoles는 절대 채널에 출력하지 않는다.
 *
 * 지식 규칙:
 *   Merlin      → 악(모드레드 제외) 전체를 봄
 *   Percival    → Merlin과 Morgana를 봄 (구분 불가)
 *   Assassin/Morgana/Mordred/Minion → 악(오베론 제외) 동료를 봄
 *   Oberon      → 아무도 모름 (악 동료에게도 숨겨짐)
 *   LoyalServant → 아무도 모름
 */
export function buildDmMessage(
  selfId: string,
  role: RoleName,
  allRoles: Map<string, RoleName>,
): string {
  const info = ROLE_INFO[role];
  const alignLabel = info.alignment === 'good'
    ? '✅ 선 (아서의 기사)'
    : '❌ 악 (모드레드의 세력)';

  let msg = `## ${info.emoji} 당신의 역할: **${info.displayName}**\n`;
  msg += `진영: ${alignLabel}\n\n`;

  if (role === 'Merlin') {
    const evilIds = [...allRoles.entries()]
      .filter(([uid, r]) => uid !== selfId && ROLE_INFO[r].alignment === 'evil' && r !== 'Mordred')
      .map(([uid]) => `<@${uid}>`);
    msg += evilIds.length > 0
      ? `👁️ **악의 세력** (모드레드 제외): ${evilIds.join(', ')}`
      : '👁️ 확인 가능한 악의 세력이 없습니다.';

  } else if (role === 'Percival') {
    const targets = [...allRoles.entries()]
      .filter(([, r]) => r === 'Merlin' || r === 'Morgana')
      .map(([uid]) => `<@${uid}>`);
    msg += targets.length > 0
      ? `👁️ **멀린 또는 모르가나** (구분 불가): ${targets.join(', ')}`
      : '👁️ 특수 능력 대상이 없습니다.';

  } else if (role === 'Oberon') {
    msg += '👁️ 당신은 동료 악당들을 알 수 없습니다. 혼자 퀘스트를 방해하세요.';

  } else if (ROLE_INFO[role].alignment === 'evil') {
    const evilIds = [...allRoles.entries()]
      .filter(([uid, r]) => uid !== selfId && ROLE_INFO[r].alignment === 'evil' && r !== 'Oberon')
      .map(([uid]) => `<@${uid}>`);
    msg += evilIds.length > 0
      ? `👁️ **동료 악당**: ${evilIds.join(', ')}`
      : '👁️ 동료 악당이 없습니다.';

  } else {
    msg += '👁️ 당신은 특별한 정보를 갖지 않습니다. 선한 판단으로 임무를 수행하세요.';
  }

  return msg;
}
