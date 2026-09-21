'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '../../../components/AdminContext';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { Table, TBody, Td, Th, THead, Tr } from '../../../components/ui/Table';
import { api, friendlyErrorMessage, query } from '../../../lib/api';
import { formatDateTime, formatRelative, humanize } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import {
  AUDIT_ACTION_LABELS,
  auditTargetHref,
  type AdminAccount,
  type AuditEvent,
  type Page,
} from '../../../lib/types';

const PAGE_SIZE = 50;

/** The detail JSON, read as a line rather than dumped as JSON. */
function describeDetail(detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(detail)) {
    if (value === null || value === undefined) continue;
    // { from, to } pairs are the common shape and the one worth reading.
    if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
      const { from, to } = value as { from: unknown; to: unknown };
      if (from === to) continue;
      parts.push(`${key}: ${String(from)} → ${String(to)}`);
      continue;
    }
    if (typeof value === 'object') continue;
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * What staff did. Owner-only, and the API enforces that too -- this page
 * refusing an agent is a courtesy, not the control.
 *
 * Read-only by design: there is no way to amend an entry from here, because
 * a log someone can edit is not evidence of anything.
 */
export default function AuditPage() {
  const { admin: me } = useAdmin();
  const isOwner = me.role === 'OWNER';

  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const loadEvents = useCallback(
    () =>
      isOwner
        ? api.get<Page<AuditEvent>>(`/admin/audit${query({ action, adminId, limit: PAGE_SIZE })}`)
        : Promise.resolve({ items: [], nextCursor: null }),
    [isOwner, action, adminId],
  );
  const { data: page, error, loading, setData } = useRequest(loadEvents, 'Could not load the log.');

  const loadActions = useCallback(
    () => (isOwner ? api.get<string[]>('/admin/audit/actions') : Promise.resolve([])),
    [isOwner],
  );
  const { data: actions } = useRequest(loadActions, 'Could not load the actions.');

  const loadAdmins = useCallback(
    () => (isOwner ? api.get<AdminAccount[]>('/admin/admins') : Promise.resolve([])),
    [isOwner],
  );
  const { data: admins } = useRequest(loadAdmins, 'Could not load the admins.');

  const events = page?.items ?? [];
  const nextCursor = page?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.get<Page<AuditEvent>>(
        `/admin/audit${query({ action, adminId, limit: PAGE_SIZE, cursor: nextCursor })}`,
      );
      setData((current) => ({ items: [...current.items, ...next.items], nextCursor: next.nextCursor }));
    } catch (err: unknown) {
      setMoreError(friendlyErrorMessage(err, 'Could not load more.'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!isOwner) {
    return (
      <>
        <PageHeader title="Audit" />
        <Alert tone="info">Only an owner can read the audit log.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Audit" description="What staff did, newest first." />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Action
          </label>
          <select
            id="audit-action"
            className="input-field py-1.5 text-sm"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            <option value="">Everything</option>
            {(actions ?? []).map((key) => (
              <option key={key} value={key}>
                {AUDIT_ACTION_LABELS[key] ?? key}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-admin" className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Admin
          </label>
          <select
            id="audit-admin"
            className="input-field py-1.5 text-sm"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
          >
            <option value="">Anyone</option>
            {(admins ?? []).map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}
      {moreError && <Alert className="mb-4">{moreError}</Alert>}

      <Card>
        {loading ? (
          <Spinner />
        ) : events.length === 0 ? (
          <EmptyState>Nothing recorded yet.</EmptyState>
        ) : (
          <Table minWidth={820}>
            <THead>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Did what</Th>
              <Th>To</Th>
            </THead>
            <TBody>
              {events.map((event) => {
                const href = auditTargetHref(event.targetType, event.targetId);
                const detail = describeDetail(event.detail);
                return (
                  <Tr key={event.id}>
                    <Td className="whitespace-nowrap text-muted">
                      <span title={formatDateTime(event.createdAt)}>
                        {formatRelative(event.createdAt)}
                      </span>
                    </Td>
                    <Td>
                      {event.admin ? (
                        <>
                          <p className="font-medium text-foreground">{event.admin.name}</p>
                          <p className="text-xs text-muted">{event.admin.email}</p>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <p className="text-foreground">
                        {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                      </p>
                      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{humanize(event.targetType)}</Badge>
                        {href ? (
                          <Link href={href} className="text-sm text-primary-soft hover:underline">
                            {event.targetLabel ?? event.targetId}
                          </Link>
                        ) : (
                          <span className="text-sm text-foreground">
                            {event.targetLabel ?? event.targetId}
                          </span>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
        {nextCursor && !loading && (
          <div className="border-t border-surface-border px-4 py-3 text-center">
            <Button variant="secondary" size="sm" onClick={loadMore} isLoading={isLoadingMore}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
