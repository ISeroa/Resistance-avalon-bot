export type RoleName =
  | 'Merlin'
  | 'Percival'
  | 'LoyalServant' // 아서의 충신 (일반 선)
  | 'Assassin'
  | 'Morgana'
  | 'Mordred'
  | 'Oberon'
  | 'Minion'; // 모드레드의 부하 (일반 악)

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
