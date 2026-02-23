import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { hasRoom, createRoom, getRoom, deleteRoom } from '../game/gameManager';
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
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'ping':   return handlePing(interaction);
    case 'create': return handleCreate(interaction);
    case 'join':   return handleJoin(interaction);
    case 'leave':  return handleLeave(interaction);
    case 'status': return handleStatus(interaction);
    case 'cancel': return handleCancel(interaction);
  }
}

// ──────────────────────────────────────────────

async function handlePing(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply('pong');
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', ephemeral: true });
    return;
  }

  if (hasRoom(guildId, channelId)) {
    await interaction.reply({
      content: '이 채널에 이미 방이 있습니다. `/avalon status`로 확인하세요.',
      ephemeral: true,
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
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', ephemeral: true });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({
      content: '이 채널에 방이 없습니다. `/avalon create`로 방을 만드세요.',
      ephemeral: true,
    });
    return;
  }

  if (room.phase !== 'waiting') {
    await interaction.reply({ content: '게임이 이미 시작되었습니다.', ephemeral: true });
    return;
  }

  const { id: userId, username } = interaction.user;

  if (room.players.some((p) => p.id === userId)) {
    await interaction.reply({ content: '이미 방에 참가 중입니다.', ephemeral: true });
    return;
  }

  if (room.players.length >= MAX_PLAYERS) {
    await interaction.reply({ content: `방이 꽉 찼습니다. (최대 ${MAX_PLAYERS}명)`, ephemeral: true });
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
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', ephemeral: true });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', ephemeral: true });
    return;
  }

  const { id: userId } = interaction.user;

  if (!room.players.some((p) => p.id === userId)) {
    await interaction.reply({ content: '방에 참가하지 않았습니다.', ephemeral: true });
    return;
  }

  if (room.hostUserId === userId) {
    deleteRoom(guildId, channelId);
    await interaction.reply({
      content: `🚪 방장 ${mentionUser(userId)}님이 나가서 방이 해체되었습니다.`,
    });
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
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', ephemeral: true });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', ephemeral: true });
    return;
  }

  const phaseLabel: Record<string, string> = {
    waiting: '🟡 대기 중',
    in_progress: '🟢 진행 중',
    finished: '🔴 종료됨',
  };

  const playerList =
    room.players.length > 0
      ? room.players
          .map((p, i) => `${i + 1}. ${mentionUser(p.id)}${p.id === room.hostUserId ? ' 👑' : ''}`)
          .join('\n')
      : '(없음)';

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Avalon 대기방')
    .setColor(0x5865f2)
    .addFields(
      { name: '상태', value: phaseLabel[room.phase] ?? room.phase, inline: true },
      { name: '인원', value: `${room.players.length} / ${MAX_PLAYERS} (최소 ${MIN_PLAYERS})`, inline: true },
      { name: '참가자', value: playerList },
    )
    .setFooter({ text: `방 생성: ${room.createdAt.toLocaleString('ko-KR')}` });

  await interaction.reply({ embeds: [embed] });
}

async function handleCancel(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, channelId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '이 커맨드는 서버에서만 사용 가능합니다.', ephemeral: true });
    return;
  }

  const room = getRoom(guildId, channelId);
  if (!room) {
    await interaction.reply({ content: '이 채널에 방이 없습니다.', ephemeral: true });
    return;
  }

  if (room.hostUserId !== interaction.user.id) {
    await interaction.reply({ content: '방장만 방을 취소할 수 있습니다.', ephemeral: true });
    return;
  }

  deleteRoom(guildId, channelId);
  await interaction.reply({ content: '🗑️ 방이 취소되었습니다.' });
}
