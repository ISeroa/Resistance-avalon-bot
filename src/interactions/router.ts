import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  MessageFlags,
} from 'discord.js';
import { execute } from '../commands/avalon';
import { handleTeamVoteButton } from './buttonHandlers';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
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

  if (customId === 'team_approve' || customId === 'team_reject') {
    await handleTeamVoteButton(interaction);
    return;
  }

  await interaction.reply({ content: '알 수 없는 버튼입니다.', flags: MessageFlags.Ephemeral });
}

async function handleSelectMenu(_interaction: StringSelectMenuInteraction): Promise<void> {
  // TODO: customId 기반 셀렉트 메뉴 핸들러 추가
}
