import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { hasRoom, createRoom, getRoom, deleteRoom } from '../game/gameManager';
import { assignRoles, buildDmMessage } from '../game/roles';
import { getTeamSize } from '../game/questConfig';
import { mentionUser } from '../utils/helpers';

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 10;

export const data = new SlashCommandBuilder()
  .setName('avalon')
  .setDescription('Avalon game commands')
  .addSubcommand((sub) =>
    sub.setName('ping').setDescription('Ping the bot'),
  )
  .addSubcommand((sub) =>
    sub.setName('create').setDescription('이 채널에 Avalon 방을 만듭니다'),
  )
  .addSubcommand((sub) =>
    sub.setName('join').setDescription('현재 채널의 Avalon 방에 참가합니다'),
  )
  .addSubcommand((sub) =>
    sub.setName('leave').setDescription('방에서 나갑니다'),
  )
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('현재 방 상태를 확인합니다'),
  )
  .addSubcommand((sub) =>
    sub.setName('cancel').setDescription('방을 강제 취소합니다 (방장 전용)'),
  )
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('게임을 시작합니다 (방장 전용, 최소 5명)'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('propose')
      .setDescription('퀘스트 팀원을 제안합니다 (리더 전용)')
      .addUserOption((o) => o.setName('m1').setDescription('팀원 1').setRequired(true))
      .addUserOption((o) => o.setName('m2').setDescription('팀원 2').setRequired(false))
      .addUserOption((o) => o.setName('m3').setDescription('팀원 3').setRequired(false))
      .addUserOption((o) => o.setName('m4').setDescription('팀원 4').setRequired(false))
      .addUserOption((o) => o.setName('m5').setDescription('팀원 5').setRequired(false)),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'ping':    return handlePing(interaction);
    case 'create':  return handleCreate(interaction);
    case 'join':    return handleJoin(interaction);
    case 'leave':   return handleLeave(interaction);
    case 'status':  return handleStatus(interaction);
    case 'cancel':  return handleCancel(interaction);
    case 'start':   return handleStart(interaction);
    case 'propose': return handlePropose(interaction);
  }
}

// ──────────────────────────────────────────────

async function handlePing(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply('pong');
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (hasRoom(guildId, channelId)) {
    await interaction.reply({
      content: '이 채널에 이미 방이 있습니다. `/avalon status`로 확인하세요.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { id: userId, username } = interaction.user;
  const room = createRoom(guildId, channelId, userId);
  room.players.push({ id: userId, username });

  await interaction.reply({
    content:
      `✅ ${mentionUser(userId)}님이 Avalon 방을 만들었습니다!\n` +
      `\`/avalon join\`으로 참가하세요. 현재 **${room.players.length}/${MAX_PLAYERS}**명 (최소 ${MIN_PLAYERS}명 필요)`,
  });
}

async function handleJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({
      content: '이 채널에 방이 없습니다. `/avalon create`로 방을 만드세요.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (room.phase !== 'waiting') {
    await interaction.reply({ content: '게임이 이미 시작되었습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const { id: userId, username } = interaction.user;

  if (room.players.some((p) => p.id === userId)) {
    await interaction.reply({ content: '이미 방에 참가 중입니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.players.length >= MAX_PLAYERS) {
    await interaction.reply({ content: `방이 꽉 찼습니다. (최대 ${MAX_PLAYERS}명)`, flags: MessageFlags.Ephemeral });
    return;
  }

  room.players.push({ id: userId, username });
  await interaction.reply({
    content: `✅ ${mentionUser(userId)}님이 참가했습니다! 현재 **${room.players.length}/${MAX_PLAYERS}**명`,
  });
}

async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const { id: userId } = interaction.user;

  if (!room.players.some((p) => p.id === userId)) {
    await interaction.reply({ content: '방에 참가하지 않았습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.hostUserId === userId) {
    deleteRoom(guildId, channelId);
    await interaction.reply({ content: `🚪 방장 ${mentionUser(userId)}님이 나가서 방이 해체되었습니다.` });
    return;
  }

  room.players = room.players.filter((p) => p.id !== userId);
  await interaction.reply({
    content: `🚪 ${mentionUser(userId)}님이 방에서 나갔습니다. 현재 **${room.players.length}/${MAX_PLAYERS}**명`,
  });
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const phaseLabel: Record<string, string> = {
    waiting:      '🟡 대기 중',
    proposal:     '🔵 팀 제안 중',
    team_vote:    '🟠 팀 투표 중',
    quest_vote:   '🟢 퀘스트 진행 중',
    assassination:'🔴 암살 단계',
    finished:     '⚫ 종료됨',
  };

  const playerList =
    room.players.length > 0
      ? room.players
          .map((p, i) => `${i + 1}. ${mentionUser(p.id)}${p.id === room.hostUserId ? ' 👑' : ''}`)
          .join('\n')
      : '(없음)';

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Avalon 게임')
    .setColor(0x5865f2)
    .addFields(
      { name: '상태', value: phaseLabel[room.phase] ?? room.phase, inline: true },
      { name: '인원', value: `${room.players.length} / ${MAX_PLAYERS}`, inline: true },
      { name: '참가자', value: playerList },
    )
    .setFooter({ text: `방 생성: ${room.createdAt.toLocaleString('ko-KR')}` });

  if (room.phase !== 'waiting') {
    const leader = room.players[room.leaderIndex];
    embed.addFields(
      { name: '라운드', value: `${room.round} / 5`, inline: true },
      { name: '리더 👑', value: leader ? mentionUser(leader.id) : '?', inline: true },
    );
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleCancel(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.hostUserId !== interaction.user.id) {
    await interaction.reply({ content: '방장만 방을 취소할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  deleteRoom(guildId, channelId);
  await interaction.reply({ content: '🗑️ 방이 취소되었습니다.' });
}

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.hostUserId !== interaction.user.id) {
    await interaction.reply({ content: '방장만 게임을 시작할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.phase !== 'waiting') {
    await interaction.reply({ content: '게임이 이미 시작되었습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.players.length < MIN_PLAYERS) {
    await interaction.reply({
      content: `최소 **${MIN_PLAYERS}**명이 필요합니다. 현재 **${room.players.length}**명입니다.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 역할 배정 (roles는 절대 로그/채널 출력 금지)
  const playerIds = room.players.map((p) => p.id);
  room.roles = assignRoles(playerIds, room.players.length);
  room.phase = 'proposal';
  room.round = 1;
  room.leaderIndex = Math.floor(Math.random() * room.players.length);

  await interaction.deferReply();

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
    .setTitle('⚔️ 아발론 게임 시작!')
    .setColor(0xe74c3c)
    .setDescription('각자 DM으로 역할을 확인하세요.')
    .addFields(
      { name: '인원', value: `${room.players.length}명`, inline: true },
      { name: '라운드', value: `1 / 5`, inline: true },
      { name: '리더 👑', value: mentionUser(leader.id) },
      { name: '이번 라운드 팀 크기', value: `${teamSize}명`, inline: true },
      { name: '다음 행동', value: `${mentionUser(leader.id)}님이 \`/avalon propose\`로 팀원을 제안하세요.` },
    );

  const dmWarning = dmFailed.length > 0
    ? `⚠️ DM 수신 실패 (DM을 허용해주세요): ${dmFailed.map(mentionUser).join(', ')}\n`
    : '';

  await interaction.editReply({ content: dmWarning || undefined, embeds: [embed] });
}

async function handlePropose(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.phase !== 'proposal') {
    await interaction.reply({ content: '지금은 팀 제안 단계가 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const leader = room.players[room.leaderIndex]!;
  if (leader.id !== interaction.user.id) {
    await interaction.reply({
      content: `현재 리더는 ${mentionUser(leader.id)}님입니다.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 제안된 팀원 수집 (중복 제거)
  const opts = interaction.options;
  const proposed = ['m1', 'm2', 'm3', 'm4', 'm5']
    .map((k) => opts.getUser(k))
    .filter((u): u is NonNullable<typeof u> => u !== null);

  const uniqueIds = [...new Set(proposed.map((u) => u.id))];

  // 방 참가자인지 확인
  const nonMembers = uniqueIds.filter((id) => !room.players.some((p) => p.id === id));
  if (nonMembers.length > 0) {
    await interaction.reply({
      content: `${nonMembers.map(mentionUser).join(', ')}님은 방에 참가하지 않았습니다.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const required = getTeamSize(room.players.length, room.round);
  if (uniqueIds.length !== required) {
    await interaction.reply({
      content: `이번 라운드(${room.round})는 **${required}명**을 제안해야 합니다. (현재 ${uniqueIds.length}명)`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 팀 확정 및 투표 단계로 전환
  room.currentTeam = uniqueIds;
  room.teamVotes = {};
  room.phase = 'team_vote';

  const teamMentions = uniqueIds.map(mentionUser).join(', ');

  const embed = new EmbedBuilder()
    .setTitle('🗳️ 팀 구성 제안')
    .setColor(0xf39c12)
    .addFields(
      { name: '라운드', value: `${room.round} / 5`, inline: true },
      { name: '제안 횟수', value: `${room.proposalNumber + 1} / 5`, inline: true },
      { name: '리더 👑', value: mentionUser(leader.id), inline: true },
      { name: `제안 팀 (${uniqueIds.length}명)`, value: teamMentions },
    )
    .setFooter({ text: '모든 플레이어가 찬성 또는 반대를 눌러주세요.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('team_approve')
      .setLabel('✅ 찬성')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('team_reject')
      .setLabel('❌ 반대')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}
