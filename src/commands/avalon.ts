import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('avalon')
  .setDescription('Avalon game commands')
  .addSubcommand((sub) =>
    sub.setName('ping').setDescription('Ping the bot'),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'ping') {
    await interaction.reply('pong');
  }
}
