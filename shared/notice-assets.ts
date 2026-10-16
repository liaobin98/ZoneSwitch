export const NOTICE_ASSET_PREFIX = '/__zoneswitch_notice/';

export function isNoticeAsset(pathname: string): boolean {
  if (!pathname.startsWith(NOTICE_ASSET_PREFIX)) return false;
  return /^(?:controls\.(?:js|css)|chunks\/[a-zA-Z0-9_.-]+\.js)$/.test(pathname.slice(NOTICE_ASSET_PREFIX.length));
}
