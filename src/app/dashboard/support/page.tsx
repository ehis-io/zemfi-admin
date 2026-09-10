'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert, EmptyState } from '../../../components/ui/Feedback';
import { api, friendlyErrorMessage, query } from '../../../lib/api';
import { formatRelative, fullName, humanize } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import { TICKET_STATUSES, type Page, type Ticket, type TicketStatus } from '../../../lib/types';

const PAGE_SIZE = 25;

const preview = (body: string, max = 140): string =>
  body.length > max ? `${body.slice(0, max).trimEnd()}…` : body;

export default function SupportPage() {
  const [status, setStatus] = useState<TicketStatus>('OPEN');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const loadFirstPage = useCallback(
    () => api.get<Page<Ticket>>(`/admin/support/tickets${query({ status, limit: PAGE_SIZE })}`),
    [status],
  );
  const { data: page, error, loading: isLoading, setData } = useRequest(loadFirstPage, 'Could not load tickets.');
  const tickets = page?.items ?? [];
  const nextCursor = page?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.get<Page<Ticket>>(
        `/admin/support/tickets${query({ status, limit: PAGE_SIZE, cursor: nextCursor })}`,
      );
      setData((current) => ({ items: [...current.items, ...next.items], nextCursor: next.nextCursor }));
    } catch (err: unknown) {
      setMoreError(friendlyErrorMessage(err, 'Could not load more tickets.'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader title="Support" description="Customer conversations, by status." />

      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-surface-border">
        {TICKET_STATUSES.map((tab) => {
          const active = tab === status;
          return (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setStatus(tab)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {humanize(tab)}
            </button>
          );
        })}
      </div>

      {(error ?? moreError) && <Alert className="mb-4">{error ?? moreError}</Alert>}

      <Card>
        {isLoading && <EmptyState>Loading tickets…</EmptyState>}
        {!isLoading && tickets.length === 0 && (
          <EmptyState>No {humanize(status).toLowerCase()} tickets.</EmptyState>
        )}
        {!isLoading && tickets.length > 0 && (
          <ul className="divide-y divide-surface-border">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/support/${ticket.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-surface-raised/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{ticket.subject}</p>
                      <p className="text-xs text-muted">
                        {fullName(ticket.customer)} · {ticket.customer.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge>{humanize(ticket.category)}</Badge>
                      <StatusBadge status={ticket.status} />
                      <span className="whitespace-nowrap text-xs text-muted">
                        {formatRelative(ticket.lastMessageAt)}
                      </span>
                    </div>
                  </div>
                  {ticket.lastMessage ? (
                    <p className="mt-2 text-sm text-muted">
                      <span className="font-semibold text-foreground/80">
                        {ticket.lastMessage.authorType === 'ADMIN' ? 'You' : 'Customer'}:
                      </span>{' '}
                      {preview(ticket.lastMessage.body)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-muted">No messages yet.</p>
                  )}
                  {ticket.transactionReference && (
                    <p className="mt-1 font-mono text-xs text-muted">Ref: {ticket.transactionReference}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && !isLoading && (
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
