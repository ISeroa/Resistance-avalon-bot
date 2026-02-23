// 인원수별 라운드별 필요 팀원 수 [R1, R2, R3, R4, R5]
const TEAM_SIZES: Readonly<Record<number, [number, number, number, number, number]>> = {
  5:  [2, 3, 2, 3, 3],
  6:  [2, 3, 4, 3, 4],
  7:  [2, 3, 3, 4, 4],
  8:  [3, 4, 4, 5, 5],
  9:  [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export function getTeamSize(playerCount: number, round: number): number {
  const sizes = TEAM_SIZES[playerCount];
  if (!sizes) throw new Error(`지원하지 않는 인원수: ${playerCount}`);
  if (round < 1 || round > 5) throw new Error(`유효하지 않은 라운드: ${round}`);
  return sizes[round - 1]!;
}

/**
 * 팀 투표 결과를 계산한다. 과반 찬성이면 true.
 */
export function isMajorityApprove(
  teamVotes: Record<string, boolean>,
  totalPlayers: number,
): boolean {
  const approveCount = Object.values(teamVotes).filter((v) => v).length;
  return approveCount > totalPlayers / 2;
}
