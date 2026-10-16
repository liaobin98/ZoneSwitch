import { existsSync, writeFileSync } from 'node:fs';
import { passwordHash } from './password.mjs';
if (existsSync('.dev.vars')) {
  process.stderr.write('已存在 .dev.vars，为避免覆盖真实配置，未写入。可按 README 单独建立演示配置。\n');
  process.exit(1);
}
const password = 'ZoneSwitch-demo-2026';
writeFileSync('.dev.vars', `CONTROL_HOST="127.0.0.1"\nWORKER_NAME="zone-switch"\nADMIN_USERNAME="admin"\nADMIN_PASSWORD_HASH="${passwordHash(password)}"\nDEMO_MODE="true"\n`, { flag: 'wx' });
process.stdout.write('已生成本地演示配置。\n运行 npm run dev，访问 http://127.0.0.1:8787\n账号：admin\n密码：' + password + '\n演示不会调用 Cloudflare API 或修改真实域名。\n');
