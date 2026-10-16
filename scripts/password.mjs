import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function passwordHash(password) {
  const salt = randomBytes(16);
  const iterations = 100000;
  return `pbkdf2-sha256$${iterations}$${salt.toString('hex')}$${pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex')}`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdin.isTTY) {
    let value = ''; for await (const chunk of process.stdin) value += chunk;
    const password = value.replace(/\r?\n$/, '');
    if (password.length < 8 || password.length > 32) throw new Error('密码长度应为 8 到 32 个字符。');
    process.stdout.write(passwordHash(password) + '\n');
  } else {
    process.stdout.write('输入管理员密码（8 到 32 位，输入不会显示）：');
    process.stdin.setRawMode(true); process.stdin.resume();
    let password = '';
    process.stdin.on('data', chunk => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') process.exit(130);
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false); process.stdin.pause();
          if (password.length < 8 || password.length > 32) { process.stderr.write('\n密码长度应为 8 到 32 个字符。\n'); process.exit(1); }
          process.stdout.write('\n\n' + passwordHash(password) + '\n'); process.exit(0);
        }
        if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
        else if (char >= ' ') password += char;
      }
    });
  }
}
