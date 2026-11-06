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
import { formatDate, formatRelative, fullName } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import type { ActiveWindow, Page, UserSummary } from '../../../lib/types';

const ACTIVE_OPTIONS: { value: '' | ActiveWindow; label: string }[] = [
  { value: '', label: 'All users' },
  { value: '7', label: 'Moved money in 7 days' },
  { value: '30', label: 'Moved money in 30 days' },
  { value: '90', label: 'Moved money in 90 days' },
  { value: 'ever', label: 'Ever moved money' },
];

const isActiveWindow = (value: string | null): value is ActiveWindow =>
  value === '7' || value === '30' || value === '90' || value === 'ever';

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

  // First page, re-run whenever the submitted search changes.
  const loadFirstPage = useCallback(
    () =>
      api.get<Page<UserSummary>>(
        `/admin/users${query({ q: submitted, active: active || undefined, limit: PAGE_SIZE })}`,
      ),
    [submitted, active],
  );
  const { data: page, error, loading: isLoading, setData } = useRequest(loadFirstPage, 'Could not load users.');
  const users = page?.items ?? [];
  const nextCursor = page?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.get<Page<UserSummary>>(
        `/admin/users${query({ q: submitted, active: active || undefined, limit: PAGE_SIZE, cursor: nextCursor })}`,
      );
      setData((current) => ({ items: [...current.items, ...next.items], nextCursor: next.nextCursor }));
    } catch (err: unknown) {
      setMoreError(friendlyErrorMessage(err, 'Could not load more users.'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader title="Users" description="Everyone with a ZemFi account." />

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
      </form>

      {(error ?? moreError) && <Alert className="mb-4">{error ?? moreError}</Alert>}

      <Card>
        <Table minWidth={920}>
          <THead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Country</Th>
            <Th>Partner</Th>
            <Th>2FA</Th>
            <Th>Last activity</Th>
            <Th className="text-right">Joined</Th>
          </THead>
          <TBody>
            {isLoading && <TableMessage colSpan={8}>Loading users…</TableMessage>}
            {!isLoading && users.length === 0 && (
              <TableMessage colSpan={8}>
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
