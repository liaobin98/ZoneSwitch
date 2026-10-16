import type { Env, Inventory, ManagedRoutes, Mode } from './types.ts';
import { mergeHosts } from './cloudflare.ts';

export function demoInventory(env: Env, policies: Record<string, Mode>, managed: ManagedRoutes = {}): Inventory {
  const routesFor = (zoneId: string) => Object.values(managed).filter(route => route.zoneId === zoneId).map(route => ({ id: route.id || route.pattern, pattern: route.pattern, script: route.script }));
  const zone = { id: 'demo-zone-1', name: 'example.com', status: 'active' };
  const zone2 = { id: 'demo-zone-2', name: 'example.net', status: 'active' };
  const records = [
    { id: '1', name: 'example.com', type: 'A', content: '192.0.2.1', proxied: true },
    { id: '2', name: 'www.example.com', type: 'CNAME', content: 'example.com', proxied: true },
    { id: '3', name: 'api.example.com', type: 'AAAA', content: '100::', proxied: true },
    { id: '4', name: 'mail.example.com', type: 'A', content: '192.0.2.2', proxied: false },
    { id: '5', name: 'legacy.example.com', type: 'A', content: '192.0.2.3', proxied: true },
  ];
  const domains = [{ hostname: 'api.example.com', zone_id: zone.id, service: 'example-api', enabled: true }, { hostname: 'app.example.net', zone_id: zone2.id, service: 'example-app', enabled: true }];
  return {
    syncedAt: new Date().toISOString(), demo: true,
    zones: [
      { ...zone, hosts: mergeHosts(zone, records, domains, [{ id: 'legacy', pattern: 'legacy.example.com/*', script: 'legacy-router' }, ...routesFor(zone.id)], env, policies, managed) },
      { ...zone2, hosts: mergeHosts(zone2, [{ id: '6', name: 'example.net', type: 'A', content: '192.0.2.4', proxied: true }], domains, routesFor(zone2.id), env, policies, managed) },
    ],
  };
}
