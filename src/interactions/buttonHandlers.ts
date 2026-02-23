import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getRoom } from '../game/gameManager';
import { isMajorityApprove } from '../game/questConfig';
import { mentionUser } from '../utils/helpers';

export async function handleTeamVoteButton(interaction: ButtonInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) return;

  const room = getRoom(guildId, channelId);
  if (!room || room.phase !== 'team_vote') {
    await interaction.reply({ content: '투표가 진행 중이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const userId = interaction.user.id;

  if (!room.players.some((p) => p.id === userId)) {
    await interaction.reply({ content: '방 참가자만 투표할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (userId in room.teamVotes) {
    await interaction.reply({ content: '이미 투표했습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const isApprove = interaction.customId === 'team_approve';
  room.teamVotes[userId] = isApprove;

  const voteCount = Object.keys(room.teamVotes).length;
  const totalPlayers = room.players.length;

  // 투표 완료 ephemeral 응답
  await interaction.reply({
    content: isApprove ? '✅ 찬성으로 투표했습니다.' : '❌ 반대로 투표했습니다.',
    flags: MessageFlags.Ephemeral,
  });

  if (voteCount < totalPlayers) {
    // 아직 전원 투표 전 — 진행 상황만 업데이트
    await interaction.message.edit({
      content: `🗳️ 투표 진행 중... **${voteCount}/${totalPlayers}**명 완료`,
    });
    return;
  }

  // ── 전원 투표 완료 → 결과 처리 ──

  const approveCount = Object.values(room.teamVotes).filter((v) => v).length;
  const rejectCount = totalPlayers - approveCount;
  const approved = isMajorityApprove(room.teamVotes, totalPlayers);

  if (approved) {
    room.phase = 'quest_vote';
    const teamMentions = room.currentTeam.map(mentionUser).join(', ');

    const embed = new EmbedBuilder()
      .setTitle('✅ 팀 구성 통과!')
      .setColor(0x2ecc71)
      .addFields(
        { name: '찬성', value: `${approveCount}명`, inline: true },
        { name: '반대', value: `${rejectCount}명`, inline: true },
        { name: '퀘스트 팀', value: teamMentions },
      )
      .setDescription('팀원들은 퀘스트 성공/실패를 결정하세요. (Phase 5에서 구현)');

    await interaction.message.edit({ content: null, embeds: [embed], components: [] });

  } else {
    room.proposalNumber++;
    room.teamVotes = {};
    room.currentTeam = [];

    if (room.proposalNumber >= 5) {
      room.phase = 'finished';

      const embed = new EmbedBuilder()
        .setTitle('💀 악의 세력 승리!')
        .setColor(0x992d22)
        .setDescription('5번 연속 부결로 악의 세력이 승리했습니다!')
        .addFields(
          { name: '최종 투표', value: `찬성 ${approveCount} / 반대 ${rejectCount}` },
        );

      await interaction.message.edit({ content: null, embeds: [embed], components: [] });

    } else {
      room.leaderIndex = (room.leaderIndex + 1) % room.players.length;
      room.phase = 'proposal';
      const newLeader = room.players[room.leaderIndex]!;

      const embed = new EmbedBuilder()
        .setTitle('❌ 팀 구성 부결')
        .setColor(0xe74c3c)
        .addFields(
          { name: '찬성', value: `${approveCount}명`, inline: true },
          { name: '반대', value: `${rejectCount}명`, inline: true },
          { name: '다음 리더 👑', value: mentionUser(newLeader.id) },
          { name: '남은 제안 횟수', value: `${5 - room.proposalNumber}회`, inline: true },
        )
        .setFooter({ text: `제안 횟수 ${room.proposalNumber}/5` });

      await interaction.message.edit({ content: null, embeds: [embed], components: [] });
    }
  }
}
