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
