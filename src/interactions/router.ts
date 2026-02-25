import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { execute } from '../commands/avalon';
import { handleTeamVoteButton, handleQuestVoteButton, handleRestartVoteButton, handleProposeMenu } from './buttonHandlers';
import { getRoom } from '../game/gameManager';
import { markActivity } from '../game/activity';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
  } else if (interaction.isUserSelectMenu()) {
    await handleUserSelectMenu(interaction);
  }

  // 모든 interaction 처리 후 해당 방의 activity 타이머를 갱신한다.
  // 핸들러가 상태 전환을 완료한 뒤 호출되므로 새 phase 기준으로 타이머가 설정된다.
  tryMarkActivity(interaction);
}

/**
 * interaction에서 방 좌표(guildId, channelId)를 추출해 markActivity를 호출한다.
 *
 * 채널 버튼/커맨드: interaction.guildId + interaction.channelId 사용
 * DM 버튼(퀘스트 투표 등): customId의 두 번째·세 번째 세그먼트에서 추출
 */
function tryMarkActivity(interaction: Interaction): void {
  let guildId: string | null = interaction.guildId;
  let channelId: string | null = interaction.channelId;

  // DM 버튼: guildId가 null — customId에서 파싱
  if (!guildId && interaction.isButton()) {
    const parts = interaction.customId.split(':');
    if (parts.length >= 3 && parts[1] && parts[2]) {
      guildId = parts[1];
      channelId = parts[2];
    }
  }

  if (!guildId || !channelId) return;

  const room = getRoom(guildId, channelId);
  if (!room) return;

  markActivity(room, interaction.client);
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'avalon':
      await execute(interaction);
      break;
    default:
      await interaction.reply({ content: '알 수 없는 커맨드입니다.', flags: MessageFlags.Ephemeral });
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  if (customId.startsWith('team_approve:') || customId.startsWith('team_reject:')) {
    await handleTeamVoteButton(interaction);
    return;
  }

  if (customId.startsWith('quest_success:') || customId.startsWith('quest_fail:')) {
    await handleQuestVoteButton(interaction);
    return;
  }

  if (customId.startsWith('restart_yes:') || customId.startsWith('restart_no:')) {
    await handleRestartVoteButton(interaction);
    return;
  }

  await interaction.reply({ content: '알 수 없는 버튼입니다.', flags: MessageFlags.Ephemeral });
}

async function handleSelectMenu(_interaction: StringSelectMenuInteraction): Promise<void> {
  // TODO: customId 기반 셀렉트 메뉴 핸들러 추가
}

async function handleUserSelectMenu(interaction: UserSelectMenuInteraction): Promise<void> {
  if (interaction.customId.startsWith('propose_team:')) {
    await handleProposeMenu(interaction);
    return;
  }
  await interaction.reply({ content: '알 수 없는 셀렉트 메뉴입니다.', flags: MessageFlags.Ephemeral });
}
