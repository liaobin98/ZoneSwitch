import type { Mode } from '../shared/contracts.ts';
export type { Mode, ServiceType, Zone, DnsRecord, WorkerDomain, WorkerRoute, Host, ZoneGroup, Inventory, Target, ChangeResult, AuditEntry } from '../shared/contracts.ts';
export interface Env {
  STATE: DurableObjectNamespace;
  ASSETS: Fetcher;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CONTROL_HOST: string;
  WORKER_NAME: string;
  MAINTENANCE_WORKER_NAME?: string;
  BILLING_WORKER_NAME?: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  DEMO_MODE?: string;
}
// 保存路由归属和待完成操作，防止恢复时删除其他人修改过的路由。
export interface ManagedRoute {
  zoneId: string; pattern: string; id?: string; script?: string;
  pendingScript?: string; pending?: boolean;
  pendingMode?: Mode; pendingDelete?: boolean;
}
export type ManagedRoutes = Record<string, ManagedRoute>;
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
