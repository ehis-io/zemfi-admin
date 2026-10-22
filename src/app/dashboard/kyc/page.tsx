'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { api, friendlyErrorMessage, query } from '../../../lib/api';
import { formatDate, formatRelative, fullName, humanize } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import {
  KYC_QUEUE_STATUSES,
  KYC_STATUS_HINTS,
  type KycQueueItem,
  type KycStatus,
  type Page,
} from '../../../lib/types';

const PAGE_SIZE = 25;

/**
 * The verification backlog, longest-waiting first -- the same ordering the
 * support queue uses, for the same reason: whoever has been stuck longest
 * is who to look at.
 *
 * Read from ZemFi's cache of the payments partner's KYC state, which is what the
 * customer's own app is being shown. A row that looks wrong is one Refresh
 * away on the user's page, and the page says so rather than leaving an
 * agent wondering whether they are looking at something stale.
 */
export default function KycPage() {
  const [status, setStatus] = useState<KycStatus>('REVIEW');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const loadQueue = useCallback(
    () => api.get<Page<KycQueueItem>>(`/admin/kyc${query({ status, limit: PAGE_SIZE })}`),
    [status],
  );
  const { data: page, error, loading, setData } = useRequest(loadQueue, 'Could not load the queue.');

  const loadCounts = useCallback(
    () => api.get<Record<string, number>>('/admin/kyc/counts'),
    [],
  );
  const { data: counts } = useRequest(loadCounts, 'Could not load the counts.');

  const items = page?.items ?? [];
  const nextCursor = page?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.get<Page<KycQueueItem>>(
        `/admin/kyc${query({ status, limit: PAGE_SIZE, cursor: nextCursor })}`,
      );
      setData((current) => ({ items: [...current.items, ...next.items], nextCursor: next.nextCursor }));
    } catch (err: unknown) {
      setMoreError(friendlyErrorMessage(err, 'Could not load more.'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader
        title="KYC"
        description="Verifications by status, longest-waiting first."
      />

      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-surface-border">
        {KYC_QUEUE_STATUSES.map((tab) => {
          const active = tab === status;
          const count = counts?.[tab];
          return (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setStatus(tab)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'border-primary text-primary-soft'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {humanize(tab)}
              {count !== undefined && (
                <span className="ml-2 tabular-nums text-xs text-muted">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mb-4 text-xs text-muted">{KYC_STATUS_HINTS[status]}</p>

      {error && <Alert className="mb-4">{error}</Alert>}
      {moreError && <Alert className="mb-4">{moreError}</Alert>}

      <Card>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState>Nothing {humanize(status).toLowerCase()}.</EmptyState>
        ) : (
          <ul className="divide-y divide-surface-border">
            {items.map((item) => (
              <li key={item.user.id} className="fade-in">
                <Link
                  href={`/dashboard/users/${item.user.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-surface/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{fullName(item.user)}</p>
                      <p className="text-xs text-muted">{item.user.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge>{item.user.country}</Badge>
                      <span className="whitespace-nowrap text-xs text-muted">
                        waiting since {formatDate(item.waitingSince)}
                      </span>
                    </div>
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-2">
                    {item.records.map((record) => (
                      <li
                        key={record.id}
                        className="flex items-center gap-2 rounded border border-surface-border px-2 py-1"
                      >
                        <span className="text-xs font-semibold text-foreground">
                          Tier {record.level}
                        </span>
                        <StatusBadge status={record.status} />
                        {record.idType && (
                          <span className="text-xs text-muted">{humanize(record.idType)}</span>
                        )}
                        {record.rejectionReason && (
                          <span className="text-xs text-danger">{record.rejectionReason}</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!item.user.dutchmanCustomerId && (
                    <p className="mt-2 text-xs text-warning">
                      Not linked to a payments partner account.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Cache last refreshed{' '}
                    {item.user.kycCacheSyncedAt
                      ? formatRelative(item.user.kycCacheSyncedAt)
                      : 'never'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
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
