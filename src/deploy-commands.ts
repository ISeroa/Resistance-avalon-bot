import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { data } from './commands/avalon';

dotenv.config();

const token = process.env['DISCORD_TOKEN'];
const clientId = process.env['DISCORD_CLIENT_ID'];
const guildId = process.env['DISCORD_GUILD_ID'];

if (!token || !clientId || !guildId) {
  console.error('DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID를 .env에 설정하세요.');
  process.exit(1);
}

const commands = [data.toJSON()];
const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`${commands.length}개의 슬래시 커맨드를 길드(${guildId})에 등록 중...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('슬래시 커맨드 길드 등록 완료. (즉시 반영)');
  } catch (err) {
    console.error('커맨드 등록 실패:', err);
    process.exit(1);
  }
})();
