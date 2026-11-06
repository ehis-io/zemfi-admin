'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Table, TBody, Td, Th, THead, Tr, TableMessage } from '../../../components/ui/Table';
import { api, friendlyErrorMessage, query } from '../../../lib/api';
import { formatAmount, formatDateTime } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import {
  TRANSACTION_KINDS,
  TRANSACTION_KIND_LABEL,
  TRANSACTION_STATES,
  type AdminTransaction,
  type Page,
  type TransactionKind,
  type TransactionState,
} from '../../../lib/types';

const PAGE_SIZE = 25;

interface Filters {
  q: string;
  kind: '' | TransactionKind;
  status: '' | TransactionState;
  /** yyyy-mm-dd, the admin's local day. */
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { q: '', kind: '', status: '', from: '', to: '' };

/** A local calendar day as the instants that bound it. */
const dayStart = (day: string): string | undefined =>
  day ? new Date(`${day}T00:00:00`).toISOString() : undefined;
const dayEnd = (day: string): string | undefined =>
  day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined;

const params = (f: Filters, cursor?: string) =>
  query({
    q: f.q,
    kind: f.kind || undefined,
    status: f.status || undefined,
    from: dayStart(f.from),
    to: dayEnd(f.to),
    limit: PAGE_SIZE,
    cursor,
  });

/**
 * Every customer's transactions, from ZemFi's own book: what to look up when
 * a customer asks where their money is.
 */
export default function TransactionsPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const loadFirstPage = useCallback(
    () => api.get<Page<AdminTransaction>>(`/admin/transactions${params(applied)}`),
    [applied],
  );
  const { data: page, error, loading, setData } = useRequest(loadFirstPage, 'Could not load transactions.');
  const rows = page?.items ?? [];
  const nextCursor = page?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.get<Page<AdminTransaction>>(`/admin/transactions${params(applied, nextCursor)}`);
      setData((current) => ({ items: [...current.items, ...next.items], nextCursor: next.nextCursor }));
    } catch (err: unknown) {
      setMoreError(friendlyErrorMessage(err, 'Could not load more transactions.'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const filtered = Object.values(applied).some(Boolean);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  // A select or date applies at once; the search box waits for Enter.
  const setNow = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    set(key, value);
    setApplied((current) => ({ ...current, [key]: value, q: draft.q.trim() }));
  };

  return (
    <>
      <PageHeader title="Transactions" description="Every customer transaction, newest first." />

      <form
        className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...draft, q: draft.q.trim() });
        }}
      >
        <input
          type="search"
          className="input-field"
          placeholder="Reference, hash, destination or customer"
          aria-label="Search transactions"
          value={draft.q}
          onChange={(event) => set('q', event.target.value)}
        />
        <select
          aria-label="Type"
          className="input-field"
          value={draft.kind}
          onChange={(event) => setNow('kind', event.target.value as Filters['kind'])}
        >
          <option value="">All types</option>
          {TRANSACTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {TRANSACTION_KIND_LABEL[kind]}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className="input-field"
          value={draft.status}
          onChange={(event) => setNow('status', event.target.value as Filters['status'])}
        >
          <option value="">All statuses</option>
          {TRANSACTION_STATES.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="From"
          className="input-field"
          value={draft.from}
          onChange={(event) => setNow('from', event.target.value)}
        />
        <input
          type="date"
          aria-label="To"
          className="input-field"
          value={draft.to}
          onChange={(event) => setNow('to', event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(NO_FILTERS);
                setApplied(NO_FILTERS);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {(error ?? moreError) && <Alert className="mb-4">{error ?? moreError}</Alert>}

      <Card>
        <Table minWidth={900}>
          <THead>
            <Th>When</Th>
            <Th>Type</Th>
            <Th>Customer</Th>
            <Th className="text-right">Amount</Th>
            <Th>Status</Th>
            <Th>Reference</Th>
          </THead>
          <TBody>
            {loading && <TableMessage colSpan={6}>Loading transactions…</TableMessage>}
            {!loading && rows.length === 0 && (
              <TableMessage colSpan={6}>
                {filtered ? 'No transactions match these filters.' : 'No transactions yet.'}
              </TableMessage>
            )}
            {!loading &&
              rows.map((tx) => (
                <Tr key={tx.id} onClick={() => router.push(`/dashboard/transactions/${tx.id}`)}>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(tx.occurredAt)}</Td>
                  <Td>
                    <p className="font-medium text-foreground">{TRANSACTION_KIND_LABEL[tx.kind] ?? tx.kind}</p>
                    {tx.destination && <p className="text-xs text-muted">to {tx.destination}</p>}
                  </Td>
                  <Td>
                    {tx.customer ? (
                      <Link
                        href={`/dashboard/users/${tx.customer.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:text-primary-soft"
                      >
                        {tx.customer.name}
                        <span className="block text-xs text-muted">{tx.customer.email}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">Deleted account</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {formatAmount(tx.amount, tx.currency)}
                    {tx.counterAmount && tx.counterCurrency && (
                      <span className="block text-xs text-muted">
                        {formatAmount(tx.counterAmount, tx.counterCurrency)}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={tx.status} />
                  </Td>
                  <Td className="max-w-[12rem] truncate font-mono text-xs text-muted">
                    <span title={tx.reference}>{tx.reference}</span>
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>
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
