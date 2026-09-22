import { Request } from 'express';
import { env } from '../../config/env';

function stripMappedIpv6(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}

export function getClientIp(req: Request): string | null {
  const remoteRaw = req.socket.remoteAddress ?? req.ip ?? null;
  const remote = remoteRaw ? stripMappedIpv6(remoteRaw) : null;
  const trusted = env.analytics.trustedProxyIps;
  const canTrustForwarded =
    trusted.length === 0 || (remote !== null && trusted.includes(remote));

  const forwarded = req.headers['x-forwarded-for'];
  if (canTrustForwarded && typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return stripMappedIpv6(first);
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (canTrustForwarded && typeof realIp === 'string' && realIp.trim().length > 0) {
    return stripMappedIpv6(realIp.trim());
  }

  return remote;
}
