import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import { hasRoom, createRoom, getRoom, deleteRoom } from '../game/gameManager';
import { assignRoles, buildDmMessage, getAssassinId, getMerlinId, ROLE_INFO } from '../game/roles';
import { getTeamSize } from '../game/questConfig';
import { clearQuestTimer } from '../game/timerManager';
import { mentionUser } from '../utils/helpers';
import { saveGame } from '../db/gameHistory';

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
      .setDescription('퀘스트 팀원을 제안합니다 (리더 전용)'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('assassinate')
      .setDescription('멀린을 암살합니다 (암살자 전용)')
      .addUserOption((o) => o.setName('target').setDescription('암살 대상').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub.setName('restart').setDescription('게임 재시작 투표를 시작합니다 (게임 진행 중 전용)'),
  )
  .addSubcommand((sub) =>
    sub.setName('history').setDescription('이 서버의 최근 게임 기록을 조회합니다'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('stats')
      .setDescription('플레이어의 전적을 조회합니다')
      .addUserOption((o) => o.setName('user').setDescription('조회할 플레이어 (생략 시 본인)').setRequired(false)),
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
    case 'propose':    return handlePropose(interaction);
    case 'assassinate': return handleAssassinate(interaction);
    case 'restart':     return handleRestart(interaction);
    case 'history':     return handleHistory(interaction);
    case 'stats':       return handleStats(interaction);
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

  if (room.phase !== 'waiting' && room.phase !== 'finished') {
    await interaction.reply({
      content: '게임 진행 중에는 나갈 수 없습니다. `/avalon restart`로 재시작 투표를 하거나 게임이 끝날 때까지 기다려주세요.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (room.hostUserId === userId) {
    deleteRoom(guildId, channelId);
    await interaction.reply({ content: `🚪 방장 ${mentionUser(userId)}님이 나가서 방이 해체되었습니다.` });
    return;
  }

  room.players = room.players.filter((p) => p.id !== userId);
  if (room.leaderIndex >= room.players.length) room.leaderIndex = 0;
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
    if (room.questResults.length > 0) {
      const record = room.questResults.map((r) => (r === 'success' ? '✅' : '❌')).join(' ');
      embed.addFields({ name: '퀘스트 기록', value: record });
    }
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

  if (room.phase !== 'waiting' && room.phase !== 'finished') {
    await interaction.reply({
      content: '게임 진행 중에는 취소할 수 없습니다. `/avalon restart`로 재시작 투표를 사용하세요.',
      flags: MessageFlags.Ephemeral,
    });
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

  const required = getTeamSize(room.players.length, room.round);

  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId(`propose_team:${guildId}:${channelId}`)
    .setPlaceholder(`팀원 ${required}명을 선택하세요`)
    .setMinValues(required)
    .setMaxValues(required);

  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: `라운드 **${room.round}** — 팀원 **${required}명**을 선택하세요. (정확히 ${required}명이어야 제출됩니다)`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  // 채널에 공개 알림: 리더가 팀원 선택 중임을 모든 플레이어에게 알림
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased() && channel.type !== ChannelType.GroupDM) {
    await channel.send({
      content: `👑 ${mentionUser(leader.id)}님이 라운드 **${room.round}** 팀원 **${required}명**을 선택 중입니다...`,
    });
  }
}

async function handleAssassinate(interaction: ChatInputCommandInteraction): Promise<void> {
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

  if (room.phase !== 'assassination') {
    await interaction.reply({ content: '암살 단계가 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const userId = interaction.user.id;
  if (room.roles.get(userId) !== 'Assassin') {
    await interaction.reply({ content: '암살자만 이 커맨드를 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getUser('target', true);

  if (target.id === userId) {
    await interaction.reply({ content: '자신을 지목할 수 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!room.players.some((p) => p.id === target.id)) {
    await interaction.reply({ content: '방 참가자만 지목할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  clearQuestTimer(guildId, channelId);
  room.phase = 'finished';

  const targetRole = room.roles.get(target.id);
  const isMerlin = targetRole === 'Merlin';
  const questRecord = room.questResults.map((r) => (r === 'success' ? '✅' : '❌')).join(' ') || '없음';

  // 게임 종료 시 전원 역할 공개
  const roleReveal = room.players
    .map((p) => {
      const role = room.roles.get(p.id)!;
      const info = ROLE_INFO[role];
      return `${mentionUser(p.id)}: ${info.emoji} ${info.displayName}`;
    })
    .join('\n');

  if (isMerlin) {
    saveGame({ room, winner: 'evil', endReason: 'assassination_success' });

    const embed = new EmbedBuilder()
      .setTitle('💀 악의 세력 승리!')
      .setColor(0x992d22)
      .setDescription(`암살자가 멀린 ${mentionUser(target.id)}을(를) 찾아냈습니다!\n악의 세력이 최후의 승리를 거뒀습니다.`)
      .addFields(
        { name: '퀘스트 기록', value: questRecord },
        { name: '역할 공개', value: roleReveal },
      );

    await interaction.reply({ embeds: [embed] });

  } else {
    saveGame({ room, winner: 'good', endReason: 'assassination_failed' });
    const merlinId = getMerlinId(room.roles);

    const embed = new EmbedBuilder()
      .setTitle('✨ 선의 세력 승리!')
      .setColor(0x2ecc71)
      .setDescription('암살자가 멀린을 찾지 못했습니다!\n선의 세력이 승리했습니다.')
      .addFields(
        {
          name: '지목된 플레이어',
          value: `${mentionUser(target.id)} (${targetRole ? ROLE_INFO[targetRole].displayName : '?'})`,
          inline: true,
        },
        { name: '진짜 멀린', value: merlinId ? mentionUser(merlinId) : '?', inline: true },
        { name: '퀘스트 기록', value: questRecord },
        { name: '역할 공개', value: roleReveal },
      );

    await interaction.reply({ embeds: [embed] });
  }
}

async function handleRestart(interaction: ChatInputCommandInteraction): Promise<void> {
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

  if (room.phase === 'waiting') {
    await interaction.reply({ content: '게임이 시작되지 않았습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!room.players.some((p) => p.id === interaction.user.id)) {
    await interaction.reply({ content: '방 참가자만 재시작 투표를 시작할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.restartVoteActive) {
    await interaction.reply({ content: '이미 재시작 투표가 진행 중입니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  room.restartVotes = {};
  room.restartVoteActive = true;

  const embed = new EmbedBuilder()
    .setTitle('🔄 게임 재시작 투표')
    .setColor(0x5865f2)
    .setDescription(
      `${mentionUser(interaction.user.id)}님이 재시작을 제안했습니다.\n현재 **${room.players.length}명**으로 새 게임을 시작합니다.`,
    )
    .setFooter({ text: '과반 찬성 시 즉시 재시작됩니다.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('restart_yes').setLabel('✅ 재시작').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('restart_no').setLabel('❌ 종료').setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// ── history ──────────────────────────────────────────────

const END_REASON_LABEL: Record<string, string> = {
  quests_evil:           '퀘스트 3회 실패',
  rejection:             '5연속 부결',
  assassination_success: '암살 성공',
  assassination_failed:  '암살 실패',
};

async function handleHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const { getGuildHistory } = await import('../db/gameHistory');
  const records = getGuildHistory(guildId, 10);

  if (records.length === 0) {
    await interaction.reply({ content: '아직 완료된 게임이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const lines = records.map((r) => {
    const winLabel = r.winner === 'good' ? '✨ 선 승리' : '💀 악 승리';
    const reason = END_REASON_LABEL[r.end_reason] ?? r.end_reason;
    const quests = (JSON.parse(r.quest_results) as string[])
      .map((q) => (q === 'success' ? '✅' : '❌'))
      .join('');
    const date = new Date(r.ended_at).toLocaleDateString('ko-KR');
    return `**#${r.id}** ${winLabel} | ${reason} | ${r.player_count}명 | ${quests || '-'} | ${date}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📜 최근 게임 기록 (최대 10개)')
    .setColor(0x5865f2)
    .setDescription(lines.join('\n'));

  await interaction.reply({ embeds: [embed] });
}

// ── stats ────────────────────────────────────────────────

async function handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getUser('user') ?? interaction.user;
  const { getUserStats } = await import('../db/gameHistory');
  const stats = getUserStats(target.id, guildId);

  if (stats.totalGames === 0) {
    await interaction.reply({
      content: `${mentionUser(target.id)}님의 게임 기록이 없습니다.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const winRate = ((stats.wins / stats.totalGames) * 100).toFixed(1);
  const roleLines = stats.roleBreakdown.map(({ role, games, wins: w }) => {
    const rate = ((w / games) * 100).toFixed(0);
    return `• ${role}: ${games}게임 (${w}승 ${games - w}패, ${rate}%)`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${target.displayName}님의 전적`)
    .setColor(0x2ecc71)
    .addFields(
      { name: '총 게임', value: `${stats.totalGames}게임`, inline: true },
      { name: '승리', value: `${stats.wins}승 (${winRate}%)`, inline: true },
      { name: '패배', value: `${stats.losses}패`, inline: true },
      { name: '역할별 전적', value: roleLines.join('\n') || '없음' },
    );

  await interaction.reply({ embeds: [embed] });
}
