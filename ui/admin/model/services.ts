import type { Host, Mode } from '../../../shared/contracts.ts';

export const modes: Mode[] = ['normal', 'maintenance', 'billing'];
export const labels: Record<Mode, string> = { normal: '正常服务', maintenance: '维护中', billing: '已欠费' };
export const actionLabels: Record<Mode, string> = { normal: '关闭维护', maintenance: '开启维护', billing: '设为欠费' };
export const descriptions: Record<Mode, string> = {
  normal: '关闭维护后，新请求恢复访问原业务服务。',
  maintenance: '服务正在维护中，请稍后再试。感谢您的理解与耐心等待。',
  billing: '服务已欠费，请及时联系管理员续费。',
};
export const colors = { normal: 'green', maintenance: 'blue', billing: 'amber' } as const;
export const hostKey = (host: Host) => host.zoneId + ':' + host.hostname;
export const selectable = (host: Host) => host.actionable || (host.mode !== 'normal' || Boolean(host.needsVerification)) && !host.reason.includes('管理后台');
