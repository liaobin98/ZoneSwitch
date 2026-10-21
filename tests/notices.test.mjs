import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { noticeMarkup, maintenanceResponse } from '../src/maintenance.ts';
import { noticeLocaleScript } from '../shared/notice-browser.ts';
import { noticeMessages } from '../shared/notice-i18n.ts';

test('静态提示页在首次绘制前按浏览器语言选择，不依赖地区或网络', () => {
  for (const mode of ['maintenance', 'billing']) {
    for (const [preferences, expected] of [
      [['zh-TW'], 'zh-Hant'], [['zh-HK'], 'zh-Hant'], [['zh-MO'], 'zh-Hant'],
      [['zh-Hant'], 'zh-Hant'], [['zh-Hant-TW'], 'zh-Hant'], [['ZH_hant_HK'], 'zh-Hant'],
      [['ja-JP'], 'ja'], [['en-US', 'ja'], 'en'], [['fr-FR', 'ja'], 'ja'],
      [['zh-CN', 'en-US'], 'en'], [['fr-FR'], 'en'], [[], 'en'],
    ]) {
      const document = { documentElement: { lang: 'en' }, title: '' };
      // 不提供 fetch、存储或 Cloudflare 元数据，脚本仍能独立选择语言。
      runInNewContext(noticeLocaleScript(mode), { navigator: { languages: preferences }, document });
      assert.equal(document.documentElement.lang, expected);
      assert.equal(document.title, noticeMessages[expected][mode].title);
    }
    const document = { documentElement: { lang: 'en' }, title: '' };
    runInNewContext(noticeLocaleScript(mode), { navigator: { language: 'ja' }, document });
    assert.equal(document.documentElement.lang, 'ja');
    const unavailable = { documentElement: { lang: 'en' }, title: '' };
    runInNewContext(noticeLocaleScript(mode), { document: unavailable });
    assert.equal(unavailable.documentElement.lang, 'en');
  }
});

test('纯静态 HTML 自带三种文案及按钮，预览不自动覆盖指定语言', async () => {
  for (const mode of ['maintenance', 'billing']) {
    const html = noticeMarkup(mode);
    assert.ok(html.indexOf(noticeLocaleScript(mode)) < html.indexOf('<body>'));
    for (const locale of ['zh-Hant', 'ja', 'en']) {
      assert.ok(html.includes(noticeMessages[locale][mode].title));
      assert.ok(html.includes(noticeMessages[locale][mode].message));
      assert.ok(html.includes(`html:not([lang="${locale}"]) [data-notice-locale="${locale}"]{display:none}`));
    }
    assert.equal((html.match(/class="notice-language-button"/g) || []).length, 3);
    const preview = maintenanceResponse(new Request('https://notice.example.com/'), mode, 'ja');
    const previewHtml = await preview.text();
    assert.equal(preview.headers.get('Content-Language'), 'ja');
    assert.ok(previewHtml.includes('<html lang="ja">'));
    assert.ok(!previewHtml.includes('<script>'));
    assert.ok(previewHtml.includes('id="notice-host">notice.example.com</div>'));
  }
});

test('两个提示页只使用静态资产，不启用 Worker 服务端入口', async () => {
  for (const mode of ['maintenance', 'billing']) {
    const configuration = await readFile(`wrangler.${mode}.jsonc`, 'utf8');
    assert.ok(!/"main"\s*:/.test(configuration));
    assert.ok(!/"binding"\s*:/.test(configuration));
    assert.match(configuration, /"run_worker_first"\s*:\s*false/);
    assert.match(configuration, /"not_found_handling"\s*:\s*"single-page-application"/);
  }
  const controls = await readFile('ui/notice/notice-controls.tsx', 'utf8');
  assert.ok(!controls.includes('fetch('));
  assert.ok(!controls.includes('/cdn-cgi/trace'));
});
