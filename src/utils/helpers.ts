/**
 * guildId + channelId 로 룸 키를 생성합니다.
 * gameManager와 동일한 포맷을 공유할 때 사용하세요.
 */
export function makeRoomKey(guildId: string, channelId: string): string {
  return `${guildId}-${channelId}`;
}

/**
 * 배열을 지정한 크기로 나눕니다. (embed 필드 분할 등에 활용)
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Discord 사용자 멘션 문자열을 반환합니다.
 */
export function mentionUser(userId: string): string {
  return `<@${userId}>`;
}
