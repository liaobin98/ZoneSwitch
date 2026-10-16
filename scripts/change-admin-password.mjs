import { readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { passwordHash } from './password.mjs';

// 只替换密码哈希，保留账号、Token、注释及原有换行格式。
export function updatePasswordConfig(path, password) {
  if (password.length < 8 || password.length > 32) throw new Error('密码长度应为 8 到 32 个字符。');
  const content = readFileSync(path, 'utf8');
  const pattern = /^[ \t]*ADMIN_PASSWORD_HASH[ \t]*=[^\r\n]*/gm;
  if ([...content.matchAll(pattern)].length !== 1) {
    throw new Error('.dev.vars 必须包含且只包含一项 ADMIN_PASSWORD_HASH，请先检查配置。');
  }
  const updated = content.replace(pattern, () => `ADMIN_PASSWORD_HASH="${passwordHash(password)}"`);
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeFileSync(temporary, updated, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function readPassword(prompt) {
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function finish(error) {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') return finish(new Error('已取消，密码未修改。'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') value = Array.from(value).slice(0, -1).join('');
      else if (!key.ctrl && !key.meta && text && !/[\x00-\x1f\x7f]/.test(text)) value += text;
    }
    process.stdin.on('keypress', onKey);
  });
}

async function main() {
  if (!process.stdin.isTTY) throw new Error('请双击 change-admin-password.bat，在交互窗口中修改密码。');
  const path = fileURLToPath(new URL('../.dev.vars', import.meta.url));
  try { readFileSync(path, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('未找到 .dev.vars，请先运行 npm run demo 或按 README 建立本地配置。');
    throw error;
  }
  process.stdout.write('修改本地管理员密码（.dev.vars）\n密码输入不会显示；按 Ctrl+C 取消。\n\n');
  emitKeypressEvents(process.stdin);
  const password = await readPassword('输入新密码（8 到 32 个字符）：');
  if (password.length < 8 || password.length > 32) throw new Error('密码长度应为 8 到 32 个字符，密码未修改。');
  const confirmation = await readPassword('再次输入新密码：');
  if (password !== confirmation) throw new Error('两次输入不一致，密码未修改。');
  updatePasswordConfig(path, password);
  process.stdout.write('\n本地管理员密码已修改。请重启 npm run dev，再用原管理员账号和新密码登录。\n此脚本只更新本地配置，线上密码请按 README 的部署说明设置。\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    process.stderr.write(`\n${error.message}\n`);
    process.exitCode = 1;
  });
}
