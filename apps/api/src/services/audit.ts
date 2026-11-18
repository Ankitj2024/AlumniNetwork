import { AuditLog } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';

export async function audit(
  actor: Viewer | null,
  action: string,
  entityType: string,
  entityId: unknown,
  details?: Record<string, unknown>,
) {
  await AuditLog.create({
    actor: actor?.id,
    actorRole: actor?.role ?? 'system',
    action,
    entityType,
    entityId,
    details,
  });
}
