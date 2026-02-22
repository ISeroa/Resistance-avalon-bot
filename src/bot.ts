import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';
import { handleInteraction } from './interactions/router';

dotenv.config();

export function startBot(): void {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteraction(interaction);
    } catch (err) {
      console.error('Interaction error:', err);
    }
  });

  const token = process.env['DISCORD_TOKEN'];
  if (!token) {
    console.error('DISCORD_TOKEN is not set in .env');
    process.exit(1);
  }

  client.login(token).catch((err) => {
    console.error('Failed to login:', err);
    process.exit(1);
  });
}
