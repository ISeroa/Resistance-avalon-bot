import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { data } from './commands/avalon';

dotenv.config();

const token = process.env['DISCORD_TOKEN'];
const clientId = process.env['DISCORD_CLIENT_ID'];

if (!token || !clientId) {
  console.error('DISCORD_TOKEN, DISCORD_CLIENT_ID를 .env에 설정하세요.');
  process.exit(1);
}

const commands = [data.toJSON()];
const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`${commands.length}개의 슬래시 커맨드를 글로벌 등록 중...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('슬래시 커맨드 글로벌 등록 완료. (반영까지 최대 1시간 소요)');
  } catch (err) {
    console.error('커맨드 등록 실패:', err);
    process.exit(1);
  }
})();
