'use client';

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Table, TBody, Td, Th, THead, Tr, TableMessage } from '../../../components/ui/Table';
import { api, friendlyErrorMessage, query } from '../../../lib/api';
import { formatAmount, formatCompactAmount, formatDate, formatRelative, fullName } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import type { ActiveWindow, TxnPeriod, TxnStats, UserPage } from '../../../lib/types';

const ACTIVE_OPTIONS: { value: '' | ActiveWindow; label: string }[] = [
  { value: '', label: 'All users' },
  { value: '7', label: 'Moved money in 7 days' },
  { value: '30', label: 'Moved money in 30 days' },
  { value: '90', label: 'Moved money in 90 days' },
  { value: 'ever', label: 'Ever moved money' },
];

const isActiveWindow = (value: string | null): value is ActiveWindow =>
  value === '7' || value === '30' || value === '90' || value === 'ever';

const PERIOD_OPTIONS: { value: TxnPeriod; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '180', label: 'Last 6 months' },
  { value: 'all', label: 'All time' },
];
const DEFAULT_PERIOD: TxnPeriod = '30';

const isPeriod = (value: string | null): value is TxnPeriod => PERIOD_OPTIONS.some((option) => option.value === value);

/** Non-zero volumes, one per currency. */
const volumes = (stats: TxnStats) => Object.entries(stats.volume).filter(([, amount]) => Number(amount) !== 0);

/** "₦4.2M" per currency, the exact amount on hover; "—" when nothing moved. */
function Volume({ stats }: { stats: TxnStats }) {
  const list = volumes(stats);
  if (!list.length) return <span>—</span>;
  return (
    <>
      {list.map(([currency, amount]) => (
        <span key={currency} className="block" title={formatAmount(amount, currency)}>
          {formatCompactAmount(amount, currency)}
        </span>
      ))}
    </>
  );
}

const PAGE_SIZE = 25;

/** useSearchParams needs a Suspense boundary for the static build. */
export default function UsersPage() {
  return (
    <Suspense>
      <UsersList />
    </Suspense>
  );
}

function UsersList() {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  // Opened from an Overview tile as ?active=30, for instance.
  const params = useSearchParams();
  const initialActive = params.get('active');
  const [active, setActive] = useState<'' | ActiveWindow>(
    isActiveWindow(initialActive) ? initialActive : '',
  );
  const initialPeriod = params.get('period');
  const [period, setPeriod] = useState<TxnPeriod>(isPeriod(initialPeriod) ? initialPeriod : DEFAULT_PERIOD);

  // First page, re-run whenever the submitted search changes.
  const loadFirstPage = useCallback(
    () =>
      api.get<UserPage>(`/admin/users${query({ q: submitted, active: active || undefined, period, limit: PAGE_SIZE })}`),
    [submitted, active, period],
  );
  const { data: page, error, loading: isLoading, setData } = useRequest(loadFirstPage, 'Could not load users.');
  const users = page?.items ?? [];
  const nextCursor = page?.nextCursor ?? null;
  // Every user's total for the period; it comes with the first page.
  const totals = page?.totals ?? null;
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label.toLowerCase();

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.get<UserPage>(
        `/admin/users${query({ q: submitted, active: active || undefined, period, limit: PAGE_SIZE, cursor: nextCursor })}`,
      );
      // Keep the first page's totals: later pages do not carry them.
      setData((current) => ({ ...current, items: [...current.items, ...next.items], nextCursor: next.nextCursor }));
    } catch (err: unknown) {
      setMoreError(friendlyErrorMessage(err, 'Could not load more users.'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with a ZemFi account. Transactions and volume count every transaction that did not fail in the chosen period; volume is the amount, per currency, before fees."
      />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(search.trim());
        }}
      >
        <input
          type="search"
          className="input-field"
          placeholder="Search by name, email or phone"
          aria-label="Search users"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <select
          aria-label="Activity"
          className="input-field max-w-[14rem]"
          value={active}
          onChange={(event) => setActive(event.target.value as '' | ActiveWindow)}
        >
          {ACTIVE_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Transactions period"
          className="input-field max-w-[12rem]"
          value={period}
          onChange={(event) => setPeriod(isPeriod(event.target.value) ? event.target.value : DEFAULT_PERIOD)}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </form>

      {totals && (
        <p className="mb-3 text-sm text-muted">
          All users, {periodLabel}:{' '}
          <span className="font-semibold text-foreground">{totals.count.toLocaleString()}</span>{' '}
          {totals.count === 1 ? 'transaction' : 'transactions'}
          {volumes(totals).map(([currency, amount]) => (
            <span key={currency} title={formatAmount(amount, currency)}>
              {' · '}
              <span className="font-semibold text-foreground">{formatCompactAmount(amount, currency)}</span> volume
            </span>
          ))}
        </p>
      )}

      {(error ?? moreError) && <Alert className="mb-4">{error ?? moreError}</Alert>}

      <Card>
        <Table minWidth={1100}>
          <THead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Country</Th>
            <Th>Partner</Th>
            <Th>2FA</Th>
            <Th className="text-right">Transactions</Th>
            <Th className="text-right">Volume</Th>
            <Th>Last activity</Th>
            <Th className="text-right">Joined</Th>
          </THead>
          <TBody>
            {isLoading && <TableMessage colSpan={10}>Loading users…</TableMessage>}
            {!isLoading && users.length === 0 && (
              <TableMessage colSpan={10}>
                {submitted
                  ? `No users match "${submitted}".`
                  : active
                    ? 'No users moved money in that period.'
                    : 'No users yet.'}
              </TableMessage>
            )}
            {!isLoading &&
              users.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <Link href={`/dashboard/users/${user.id}`} className="font-medium text-foreground hover:text-primary-soft">
                      {fullName(user)}
                    </Link>
                  </Td>
                  <Td className="text-muted">{user.email}</Td>
                  <Td className="whitespace-nowrap text-muted">{user.phoneNumber || '—'}</Td>
                  <Td className="text-muted">{user.country || '—'}</Td>
                  <Td>
                    {user.dutchmanCustomerId ? (
                      <Badge tone="success">Linked</Badge>
                    ) : (
                      <Badge tone="neutral">Not linked</Badge>
                    )}
                  </Td>
                  <Td>
                    {user.twoFactorEnabled ? <Badge tone="info">On</Badge> : <Badge tone="neutral">Off</Badge>}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {user.transactions ? user.transactions.count.toLocaleString() : '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums text-muted">
                    {user.transactions ? <Volume stats={user.transactions} /> : '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-muted" >
                    {user.lastActivityAt ? formatRelative(user.lastActivityAt) : 'Never'}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-muted">{formatDate(user.createdAt)}</Td>
                </Tr>
              ))}
          </TBody>
        </Table>
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
