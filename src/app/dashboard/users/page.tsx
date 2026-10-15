'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Table, TBody, Td, Th, THead, Tr, TableMessage } from '../../../components/ui/Table';
import { api, friendlyErrorMessage, query } from '../../../lib/api';
import { formatDate, fullName } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import type { Page, UserSummary } from '../../../lib/types';

const PAGE_SIZE = 25;

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  // First page, re-run whenever the submitted search changes.
  const loadFirstPage = useCallback(
    () => api.get<Page<UserSummary>>(`/admin/users${query({ q: submitted, limit: PAGE_SIZE })}`),
    [submitted],
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
        `/admin/users${query({ q: submitted, limit: PAGE_SIZE, cursor: nextCursor })}`,
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
      </form>

      {(error ?? moreError) && <Alert className="mb-4">{error ?? moreError}</Alert>}

      <Card>
        <Table minWidth={820}>
          <THead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Country</Th>
            <Th>Partner</Th>
            <Th>2FA</Th>
            <Th className="text-right">Joined</Th>
          </THead>
          <TBody>
            {isLoading && <TableMessage colSpan={7}>Loading users…</TableMessage>}
            {!isLoading && users.length === 0 && (
              <TableMessage colSpan={7}>
                {submitted ? `No users match "${submitted}".` : 'No users yet.'}
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
