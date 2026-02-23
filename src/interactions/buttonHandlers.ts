import {
  ButtonInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getRoom } from '../game/gameManager';
import { isMajorityApprove, isQuestFailed, checkWinCondition, getTeamSize } from '../game/questConfig';
import { ROLE_INFO } from '../game/roles';
import { GameState } from '../game/GameState';
import { mentionUser } from '../utils/helpers';

// ── 팀 투표 버튼 핸들러 ───────────────────────────────────

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

  await interaction.reply({
    content: isApprove ? '✅ 찬성으로 투표했습니다.' : '❌ 반대로 투표했습니다.',
    flags: MessageFlags.Ephemeral,
  });

  if (voteCount < totalPlayers) {
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
    room.questVotes = {};
    const teamMentions = room.currentTeam.map(mentionUser).join(', ');

    const dmFailed = await sendQuestVoteDms(interaction, room, guildId, channelId);

    const embed = new EmbedBuilder()
      .setTitle('✅ 팀 구성 통과!')
      .setColor(0x2ecc71)
      .addFields(
        { name: '찬성', value: `${approveCount}명`, inline: true },
        { name: '반대', value: `${rejectCount}명`, inline: true },
        { name: '퀘스트 팀', value: teamMentions },
      )
      .setDescription(
        dmFailed.length > 0
          ? `⚠️ DM 실패: ${dmFailed.map(mentionUser).join(', ')}\n📨 나머지 팀원들에게 퀘스트 투표 DM을 보냈습니다.`
          : '📨 팀원들에게 퀘스트 투표 DM을 보냈습니다. 투표를 완료해주세요.',
      );

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

// ── 퀘스트 투표 DM 전송 ───────────────────────────────────

async function sendQuestVoteDms(
  interaction: ButtonInteraction,
  room: GameState,
  guildId: string,
  channelId: string,
): Promise<string[]> {
  const failed: string[] = [];

  await Promise.all(
    room.currentTeam.map(async (userId) => {
      const role = room.roles.get(userId);
      const isEvil = role ? ROLE_INFO[role].alignment === 'evil' : false;

      const successBtn = new ButtonBuilder()
        .setCustomId(`quest_success:${guildId}:${channelId}`)
        .setLabel('✅ 성공')
        .setStyle(ButtonStyle.Success);

      const failBtn = new ButtonBuilder()
        .setCustomId(`quest_fail:${guildId}:${channelId}`)
        .setLabel('❌ 실패')
        .setStyle(ButtonStyle.Danger);

      // 선 진영: 성공만 / 악 진영: 성공 + 실패 선택 가능
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...(isEvil ? [successBtn, failBtn] : [successBtn]),
      );

      try {
        const user = await interaction.client.users.fetch(userId);
        await user.send({
          content: `🗺️ **퀘스트 투표** (라운드 ${room.round})\n퀘스트 결과를 선택하세요.`,
          components: [row],
        });
      } catch {
        failed.push(userId);
      }
    }),
  );

  return failed;
}

// ── 퀘스트 투표 버튼 핸들러 (DM에서 호출) ────────────────

export async function handleQuestVoteButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const guildId = parts[1];
  const channelId = parts[2];

  if (!guildId || !channelId) {
    await interaction.reply({ content: '잘못된 버튼입니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room || room.phase !== 'quest_vote') {
    await interaction.reply({ content: '퀘스트 투표가 진행 중이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const userId = interaction.user.id;

  if (!room.currentTeam.includes(userId)) {
    await interaction.reply({ content: '퀘스트 팀원만 투표할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (userId in room.questVotes) {
    await interaction.reply({ content: '이미 투표했습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const isSuccess = interaction.customId.startsWith('quest_success');
  room.questVotes[userId] = isSuccess;

  // DM 메시지 버튼 제거 (중복 투표 방지 UX)
  await interaction.update({
    content: isSuccess ? '✅ 성공으로 투표했습니다.' : '❌ 실패로 투표했습니다.',
    components: [],
  });

  if (Object.keys(room.questVotes).length < room.currentTeam.length) {
    return; // 아직 전원 투표 전
  }

  await resolveQuest(interaction, room, guildId, channelId);
}

// ── 퀘스트 결과 처리 ─────────────────────────────────────

async function resolveQuest(
  interaction: ButtonInteraction,
  room: GameState,
  guildId: string,
  channelId: string,
): Promise<void> {
  const failCount = Object.values(room.questVotes).filter((v) => !v).length;
  const failed = isQuestFailed(failCount, room.players.length, room.round);
  const result = failed ? 'fail' : 'success';

  room.questResults.push(result);

  const winState = checkWinCondition(room.questResults);
  const questRecord = room.questResults.map((r) => (r === 'success' ? '✅' : '❌')).join(' ');

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  if (winState === 'evil_wins') {
    room.phase = 'finished';

    const embed = new EmbedBuilder()
      .setTitle('💀 악의 세력 승리!')
      .setColor(0x992d22)
      .setDescription('퀘스트가 3번 실패했습니다. 악의 세력이 승리했습니다!')
      .addFields(
        { name: '퀘스트 기록', value: questRecord },
        { name: '실패 투표', value: `${failCount}표`, inline: true },
      );

    await channel.send({ embeds: [embed] });
    return;
  }

  if (winState === 'good_wins_assassination') {
    room.phase = 'assassination';

    const embed = new EmbedBuilder()
      .setTitle('🗡️ 암살 단계 시작')
      .setColor(0xe74c3c)
      .setDescription('퀘스트 3번 성공! 암살자는 멀린을 지목하세요.\n(Phase 6 구현 예정)')
      .addFields(
        { name: '퀘스트 기록', value: questRecord },
      );

    await channel.send({ embeds: [embed] });
    return;
  }

  // ── 다음 라운드 ──
  room.round++;
  room.proposalNumber = 0;
  room.leaderIndex = (room.leaderIndex + 1) % room.players.length;
  room.currentTeam = [];
  room.questVotes = {};
  room.teamVotes = {};
  room.phase = 'proposal';

  const nextLeader = room.players[room.leaderIndex]!;
  const teamSize = getTeamSize(room.players.length, room.round);

  const embed = new EmbedBuilder()
    .setTitle(failed ? '❌ 퀘스트 실패' : '✅ 퀘스트 성공')
    .setColor(failed ? 0xe74c3c : 0x2ecc71)
    .setDescription(`${mentionUser(nextLeader.id)}님이 \`/avalon propose\`로 팀원을 제안하세요.`)
    .addFields(
      { name: '실패 투표', value: `${failCount}표`, inline: true },
      { name: '퀘스트 기록', value: questRecord },
      { name: '다음 라운드', value: `${room.round} / 5`, inline: true },
      { name: '다음 리더 👑', value: mentionUser(nextLeader.id), inline: true },
      { name: '팀 크기', value: `${teamSize}명`, inline: true },
    );

  await channel.send({ embeds: [embed] });
}
