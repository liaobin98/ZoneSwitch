import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { noticeMarkup, noticeHeaders } from '../src/maintenance.ts';

export async function buildStaticNotices() {
  const outputRoot = resolve('dist');
  for (const mode of ['maintenance', 'billing']) {
    const target = resolve(outputRoot, 'static-' + mode);
    if (!target.startsWith(outputRoot + sep)) throw new Error('静态输出目录超出 dist。');
    await mkdir(target, { recursive: true });
    // 保留目录本身，避免 Windows 上运行中的 Wrangler 文件监听锁住目录。
    for (const entry of await readdir(target)) {
      const entryPath = resolve(target, entry);
      if (!entryPath.startsWith(target + sep)) throw new Error('静态文件路径超出输出目录。');
      await rm(entryPath, { recursive: true, force: true });
    }
    await cp(resolve(outputRoot, 'client/__zoneswitch_notice'), resolve(target, '__zoneswitch_notice'), { recursive: true });
    await writeFile(resolve(target, 'index.html'), noticeMarkup(mode));
    await writeFile(resolve(target, '_headers'), '/*\n' + Object.entries(noticeHeaders).map(([key, value]) => '  ' + key + ': ' + value).join('\n') + '\n');
    await writeFile(resolve(target, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }
}
