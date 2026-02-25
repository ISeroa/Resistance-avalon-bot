import {
  ButtonInteraction,
  UserSelectMenuInteraction,
  Client,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getRoom } from '../game/gameManager';
import { isMajorityApprove, isQuestFailed, checkWinCondition, getTeamSize } from '../game/questConfig';
import { ROLE_INFO, assignRoles, buildDmMessage } from '../game/roles';
import { GameState } from '../game/GameState';
import { setQuestTimer, clearQuestTimer, QUEST_TIMEOUT_MS } from '../game/timerManager';
import { toQuestVote, toProposalAfterRejection, toNextRound, toAssassination, toFinished } from '../game/transitions';
import { mentionUser } from '../utils/helpers';
import { saveGame } from '../db/gameHistory';

const NO_ROOM_MSG = '게임이 실행 중이 아닙니다. /avalon create 또는 /avalon start 로 새 게임을 시작하세요.';

// ── 팀 투표 버튼 핸들러 ───────────────────────────────────

export async function handleTeamVoteButton(interaction: ButtonInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) return;
  const [, cidGuild, cidChannel] = interaction.customId.split(':');
  if (cidGuild !== guildId || cidChannel !== channelId) return;

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: NO_ROOM_MSG, flags: MessageFlags.Ephemeral });
    return;
  }
  if (room.phase !== 'team_vote') {
    await interaction.reply({ content: '투표가 진행 중이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.activeTeamVoteMessageId && interaction.message.id !== room.activeTeamVoteMessageId) {
    await interaction.reply({ content: '현재 진행 중인 투표 메시지가 아닙니다.', flags: MessageFlags.Ephemeral });
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

  const isApprove = interaction.customId.startsWith('team_approve:');
  room.teamVotes[userId] = isApprove;

  const voteCount = Object.keys(room.teamVotes).length;
  const totalPlayers = room.players.length;

  await interaction.reply({
    content: isApprove ? '✅ 찬성으로 투표했습니다.' : '❌ 반대로 투표했습니다.',
    flags: MessageFlags.Ephemeral,
  });

  if (voteCount < totalPlayers) {
    if (room.phase !== 'team_vote' || interaction.message.id !== room.activeTeamVoteMessageId) return;
    await interaction.message.edit({
      content: `🗳️ 투표 진행 중... **${voteCount}/${totalPlayers}**명 완료`,
    });
    return;
  }

  // ── 전원 투표 완료 → 결과 처리 (중복 실행 방지) ──
  if (room.isTransitioning) return;
  room.isTransitioning = true;

  try {
  const approveCount = Object.values(room.teamVotes).filter((v) => v).length;
  const rejectCount = totalPlayers - approveCount;
  const approved = isMajorityApprove(room.teamVotes, totalPlayers);

  if (approved) {
    toQuestVote(room);
    room.questSessionId++;
    const teamMentions = room.currentTeam.map(mentionUser).join(', ');

    const dmFailed = await sendQuestVoteDms(interaction, room, guildId, channelId);

    // ── 퀘스트 투표 타임아웃 설정 ──
    const client = interaction.client;
    setQuestTimer(guildId, channelId, async () => {
      const r = getRoom(guildId, channelId);
      if (!r || r.phase !== 'quest_vote') return;

      const timedOut = r.currentTeam.filter((id) => !(id in r.questVotes));
      for (const id of timedOut) r.questVotes[id] = true; // 미투표 → 성공 처리

      const ch = await client.channels.fetch(channelId).catch(() => null);
      if (ch?.isTextBased() && ch.type !== ChannelType.GroupDM && timedOut.length > 0) {
        await ch.send({
          content: `⏰ 퀘스트 투표 시간 초과 (${QUEST_TIMEOUT_MS / 60000}분)!\n미투표: ${timedOut.map(mentionUser).join(', ')} → 성공으로 처리됩니다.`,
        });
      }

      await resolveQuest(client, r, guildId, channelId);
    });

    const timeoutMin = QUEST_TIMEOUT_MS / 60000;
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
          ? `⚠️ DM 실패: ${dmFailed.map(mentionUser).join(', ')}\n📨 나머지 팀원들에게 퀘스트 투표 DM을 보냈습니다. (${timeoutMin}분 내 완료)`
          : `📨 팀원들에게 퀘스트 투표 DM을 보냈습니다. **${timeoutMin}분** 내에 투표해주세요.`,
      );

    await interaction.message.edit({ content: null, embeds: [embed], components: [] });

    // ── DM 실패 플레이어 채널 대체 버튼 전송 ──
    if (dmFailed.length > 0) {
      const fallbackCh = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (fallbackCh?.isTextBased() && fallbackCh.type !== ChannelType.GroupDM) {
        await Promise.all(
          dmFailed.map((userId) =>
            (fallbackCh as import('discord.js').TextChannel).send({
              content: `📢 ${mentionUser(userId)}님 DM 전송 실패 — 아래 버튼으로 퀘스트 투표해주세요.`,
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`quest_success:${guildId}:${channelId}`)
                    .setLabel('✅ 성공')
                    .setStyle(ButtonStyle.Success),
                ),
              ],
            }),
          ),
        );
      }
    }

  } else {
    if (room.proposalNumber + 1 >= 5) {
      room.proposalNumber++;
      room.teamVotes = {};
      room.currentTeam = [];
      clearQuestTimer(guildId, channelId);
      toFinished(room);
      saveGame({ room, winner: 'evil', endReason: 'rejection' });

      const embed = new EmbedBuilder()
        .setTitle('💀 악의 세력 승리!')
        .setColor(0x992d22)
        .setDescription('5번 연속 부결로 악의 세력이 승리했습니다!')
        .addFields(
          { name: '최종 투표', value: `찬성 ${approveCount} / 반대 ${rejectCount}` },
        );

      await interaction.message.edit({ content: null, embeds: [embed], components: [] });

    } else {
      toProposalAfterRejection(room);
      const newLeader = room.players[room.leaderIndex]!;
      const teamSize = getTeamSize(room.players.length, room.round);

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

      // 채널 하단에 새 메시지를 보내 현재 리더를 모든 플레이어에게 명확히 알림
      const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased() && channel.type !== ChannelType.GroupDM) {
        await channel.send({
          content: `👑 다음 리더: ${mentionUser(newLeader.id)} | 라운드 **${room.round}** 팀원 **${teamSize}명** | 제안 횟수 **${room.proposalNumber}/5**\n${mentionUser(newLeader.id)}님이 \`/avalon propose\`로 팀원을 제안하세요.`,
        });
      }
    }
  }
  } finally {
    room.isTransitioning = false;
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
          content: `🗺️ **퀘스트 투표** (라운드 ${room.round})\n퀘스트 결과를 선택하세요. (**${QUEST_TIMEOUT_MS / 60000}분** 내에 투표하지 않으면 성공으로 처리됩니다.)`,
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
  if (!room) {
    await interaction.reply({ content: NO_ROOM_MSG, flags: MessageFlags.Ephemeral });
    return;
  }
  if (room.phase !== 'quest_vote') {
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

  // 전원 투표 완료 → 타이머 취소 후 결과 처리
  clearQuestTimer(guildId, channelId);
  await resolveQuest(interaction.client, room, guildId, channelId);
}

// ── 퀘스트 결과 처리 ─────────────────────────────────────

async function resolveQuest(
  client: Client,
  room: GameState,
  guildId: string,
  channelId: string,
): Promise<void> {
  // guard: 타임아웃 콜백과 마지막 투표가 겹칠 때 중복 실행 방지
  if (room.phase !== 'quest_vote') return;
  if (room.isTransitioning) return;

  room.isTransitioning = true;
  try {
    const sid = room.questSessionId;
    clearQuestTimer(guildId, channelId);

    const failCount = Object.values(room.questVotes).filter((v) => !v).length;
    const failed = isQuestFailed(failCount, room.players.length, room.round);
    const result = failed ? 'fail' : 'success';

    room.questResults.push(result);

    const winState = checkWinCondition(room.questResults);
    const questRecord = room.questResults.map((r) => (r === 'success' ? '✅' : '❌')).join(' ');

    // ── 상태 변경을 첫 await 이전에 모두 완료 ──
    // 이 시점 이후 두 번째 호출이 들어오면 위 phase guard에서 차단됨
    if (winState === 'evil_wins') {
      toFinished(room);
      saveGame({ room, winner: 'evil', endReason: 'quests_evil' });
    } else if (winState === 'good_wins_assassination') {
      toAssassination(room);
    } else {
      toNextRound(room);
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.type === ChannelType.GroupDM) return;
    if (room.questSessionId !== sid) return;

    if (winState === 'evil_wins') {
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
      const embed = new EmbedBuilder()
        .setTitle('🗡️ 암살 단계 시작')
        .setColor(0xe74c3c)
        .setDescription(
          '퀘스트 3번 성공!\n암살자는 `/avalon assassinate`로 멀린을 지목하세요.\n(암살자는 역할 DM을 확인하세요.)',
        )
        .addFields({ name: '퀘스트 기록', value: questRecord });

      await channel.send({ embeds: [embed] });
      return;
    }

    // ── 다음 라운드 (state는 위에서 이미 변경됨) ──
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
  } finally {
    room.isTransitioning = false;
  }
}

// ── 재시작 투표 버튼 핸들러 ───────────────────────────────

export async function handleRestartVoteButton(interaction: ButtonInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) return;
  const [, cidGuild, cidChannel] = interaction.customId.split(':');
  if (cidGuild !== guildId || cidChannel !== channelId) return;

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: NO_ROOM_MSG, flags: MessageFlags.Ephemeral });
    return;
  }

  const userId = interaction.user.id;

  if (!room.players.some((p) => p.id === userId)) {
    await interaction.reply({ content: '방 참가자만 투표할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (userId in room.restartVotes) {
    await interaction.reply({ content: '이미 투표했습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const isYes = interaction.customId.startsWith('restart_yes:');
  room.restartVotes[userId] = isYes;

  await interaction.reply({
    content: isYes ? '✅ 재시작에 투표했습니다.' : '❌ 종료에 투표했습니다.',
    flags: MessageFlags.Ephemeral,
  });

  // await 이후 재진입 방지: 다른 핸들러가 이미 결과 처리를 완료했을 수 있음
  if (!room.restartVoteActive) return;

  const totalPlayers = room.players.length;
  const voteCount = Object.keys(room.restartVotes).length;
  const yesCount = Object.values(room.restartVotes).filter((v) => v).length;
  const noCount = voteCount - yesCount;
  const majority = Math.floor(totalPlayers / 2) + 1;

  if (yesCount >= majority) {
    room.restartVotes = {};
    room.restartVoteActive = false;
    await performRestart(interaction, room);
    return;
  }

  if (noCount >= majority) {
    room.restartVotes = {};
    room.restartVoteActive = false;
    await interaction.message.edit({
      content: `🚫 재시작 투표 부결 (찬성 ${yesCount} / 반대 ${noCount})`,
      embeds: [],
      components: [],
    });
    return;
  }

  // 전원 투표했지만 과반 미달 (동수) → 부결
  if (voteCount >= totalPlayers) {
    room.restartVotes = {};
    room.restartVoteActive = false;
    await interaction.message.edit({
      content: `🚫 재시작 투표 부결 (찬성 ${yesCount} / 반대 ${noCount})`,
      embeds: [],
      components: [],
    });
    return;
  }

  await interaction.message.edit({
    content: `🔄 재시작 투표 진행 중... **${voteCount}/${totalPlayers}**명 (찬성 ${yesCount} / 반대 ${noCount})`,
  });
}

// ── 게임 재시작 처리 ─────────────────────────────────────

async function performRestart(
  interaction: ButtonInteraction,
  room: GameState,
): Promise<void> {
  // 진행 중 퀘스트 타이머 취소
  clearQuestTimer(room.guildId, room.channelId);

  const playerIds = room.players.map((p) => p.id);

  room.roles = assignRoles(playerIds, playerIds.length);
  room.phase = 'proposal';
  room.round = 1;
  room.leaderIndex = Math.floor(Math.random() * playerIds.length);
  room.proposalNumber = 0;
  room.questResults = [];
  room.currentTeam = [];
  room.teamVotes = {};
  room.questVotes = {};
  room.activeTeamVoteMessageId = null;
  room.isTransitioning = false;
  room.questSessionId++;

  const dmFailed: string[] = [];
  await Promise.all(
    room.players.map(async (player) => {
      const role = room.roles.get(player.id)!;
      const msg = buildDmMessage(player.id, role, room.roles);
      try {
        const user = await interaction.client.users.fetch(player.id);
        await user.send(msg);
      } catch {
        dmFailed.push(player.id);
      }
    }),
  );

  const leader = room.players[room.leaderIndex]!;
  const teamSize = getTeamSize(room.players.length, room.round);

  const embed = new EmbedBuilder()
    .setTitle('🔄 게임 재시작!')
    .setColor(0x5865f2)
    .setDescription('각자 DM으로 새 역할을 확인하세요.')
    .addFields(
      { name: '인원', value: `${room.players.length}명`, inline: true },
      { name: '라운드', value: '1 / 5', inline: true },
      { name: '리더 👑', value: mentionUser(leader.id) },
      { name: '이번 라운드 팀 크기', value: `${teamSize}명`, inline: true },
      { name: '다음 행동', value: `${mentionUser(leader.id)}님이 \`/avalon propose\`로 팀원을 제안하세요.` },
    );

  const dmWarning = dmFailed.length > 0
    ? `⚠️ DM 수신 실패: ${dmFailed.map(mentionUser).join(', ')}\n`
    : '';

  await interaction.message.edit({
    content: dmWarning || null,
    embeds: [embed],
    components: [],
  });
}

// ── 팀 구성 유저 셀렉트 메뉴 핸들러 ──────────────────────

export async function handleProposeMenu(interaction: UserSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const guildId = parts[1];
  const channelId = parts[2];

  if (!guildId || !channelId) {
    await interaction.update({ content: '잘못된 요청입니다.', components: [] });
    return;
  }
  if (interaction.guildId !== guildId || interaction.channelId !== channelId) {
    await interaction.update({ content: '잘못된 요청입니다.', components: [] });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.update({ content: NO_ROOM_MSG, components: [] });
    return;
  }
  if (room.phase !== 'proposal') {
    await interaction.update({ content: '지금은 팀 제안 단계가 아닙니다.', components: [] });
    return;
  }

  const leader = room.players[room.leaderIndex]!;
  if (leader.id !== interaction.user.id) {
    await interaction.update({
      content: `현재 리더는 ${mentionUser(leader.id)}님입니다.`,
      components: [],
    });
    return;
  }

  const selectedIds = interaction.values;

  // 방 참가자인지 확인
  const nonMembers = selectedIds.filter((id) => !room.players.some((p) => p.id === id));
  if (nonMembers.length > 0) {
    await interaction.update({
      content: `${nonMembers.map(mentionUser).join(', ')}님은 방에 참가하지 않았습니다.`,
      components: [],
    });
    return;
  }

  room.currentTeam = selectedIds;
  room.teamVotes = {};

  // 에페머럴 메시지 완료 처리
  await interaction.update({ content: '✅ 팀 구성이 제안되었습니다.', components: [] });

  // 채널에 공개 투표 embed 전송
  const teamMentions = selectedIds.map(mentionUser).join(', ');

  const embed = new EmbedBuilder()
    .setTitle('🗳️ 팀 구성 제안')
    .setColor(0xf39c12)
    .addFields(
      { name: '라운드', value: `${room.round} / 5`, inline: true },
      { name: '제안 횟수', value: `${room.proposalNumber + 1} / 5`, inline: true },
      { name: '리더 👑', value: mentionUser(leader.id), inline: true },
      { name: `제안 팀 (${selectedIds.length}명)`, value: teamMentions },
    )
    .setFooter({ text: '모든 플레이어가 찬성 또는 반대를 눌러주세요.' });

  const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`team_approve:${guildId}:${channelId}`)
      .setLabel('✅ 찬성')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`team_reject:${guildId}:${channelId}`)
      .setLabel('❌ 반대')
      .setStyle(ButtonStyle.Danger),
  );

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased() && channel.type !== ChannelType.GroupDM) {
    try {
      const voteMsg = await channel.send({ embeds: [embed], components: [voteRow] });
      room.activeTeamVoteMessageId = voteMsg.id;
      room.phase = 'team_vote';
    } catch {
      room.currentTeam = [];
    }
  } else {
    room.currentTeam = [];
  }
}
