export type Mode = 'normal' | 'maintenance' | 'billing';
export type ServiceType = 'worker' | 'proxy' | 'dns';
export interface Zone { id: string; name: string; status: string }
export interface DnsRecord { id: string; name: string; type: string; content: string; proxied?: boolean }
export interface WorkerDomain { hostname: string; zone_id: string; service: string; enabled?: boolean }
export interface WorkerRoute { id: string; pattern: string; script?: string }
export interface Host {
  hostname: string; zoneId: string; type: ServiceType; service: string; records: string[];
  dnsRecords?: { type: string; content: string }[];
  mode: Mode; connected: boolean; actionable: boolean; reason: string;
  needsVerification?: boolean;
}
export interface ZoneGroup extends Zone { hosts: Host[]; error?: string }
export interface Inventory { zones: ZoneGroup[]; syncedAt: string | null; demo: boolean }
export interface Target { zoneId: string; hostname: string }
export interface ChangeResult extends Target { success: boolean; mode?: Mode; error?: string; uncertain?: boolean }
export interface AuditEntry { time: string; username: string; mode: Mode; results: ChangeResult[] }
export interface AuditPage { entries: AuditEntry[]; page: number; pageSize: number; total: number; totalPages: number }
