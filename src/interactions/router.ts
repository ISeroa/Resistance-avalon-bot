import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { execute } from '../commands/avalon';

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
      await interaction.reply({ content: '알 수 없는 커맨드입니다.', ephemeral: true });
  }
}

async function handleButton(_interaction: ButtonInteraction): Promise<void> {
  // TODO: customId 기반 버튼 핸들러 추가
}

async function handleSelectMenu(_interaction: StringSelectMenuInteraction): Promise<void> {
  // TODO: customId 기반 셀렉트 메뉴 핸들러 추가
}
