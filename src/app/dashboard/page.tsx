'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Alert, Spinner } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/Badge';
import { Table, TBody, Td, Th, THead, Tr, TableMessage } from '../../components/ui/Table';
import { api, friendlyErrorMessage, query } from '../../lib/api';
import { formatRelative, fullName, humanize } from '../../lib/format';
import type { Page, Stats, Ticket } from '../../lib/types';

const LATEST_OPEN_LIMIT = 8;

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<Stats>('/admin/stats'),
      api.get<Page<Ticket>>(`/admin/support/tickets${query({ status: 'OPEN', limit: LATEST_OPEN_LIMIT })}`),
    ])
      .then(([nextStats, page]) => {
        if (cancelled) return;
        setStats(nextStats);
        setTickets(page.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(friendlyErrorMessage(err, 'Could not load the overview.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <>
        <PageHeader title="Overview" />
        <Alert>{error}</Alert>
      </>
    );
  }

  if (!stats || !tickets) {
    return (
      <>
        <PageHeader title="Overview" />
        <Spinner />
      </>
    );
  }

  const tiles: { label: string; value: number; hint?: string }[] = [
    { label: 'Users', value: stats.users },
    { label: 'Linked to partner', value: stats.usersLinkedToBridge, hint: 'have a payments partner account' },
    { label: '2FA enabled', value: stats.twoFactorEnabled },
    { label: 'New in 7 days', value: stats.newUsersLast7Days },
    { label: 'Open tickets', value: stats.tickets.open },
    { label: 'Awaiting user', value: stats.tickets.awaitingUser },
    { label: 'Resolved', value: stats.tickets.resolved },
    { label: 'Closed', value: stats.tickets.closed },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Where the product stands right now." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card fade-in p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {tile.value.toLocaleString()}
            </p>
            {tile.hint && <p className="text-xs text-muted">{tile.hint}</p>}
          </div>
        ))}
      </div>

      <Card
        className="mt-8"
        title="Latest open tickets"
        actions={
          <Link href="/dashboard/support" className="text-xs font-semibold text-primary-soft hover:underline">
            View all
          </Link>
        }
      >
        <Table>
          <THead>
            <Th>Subject</Th>
            <Th>Customer</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th className="text-right">Last activity</Th>
          </THead>
          <TBody>
            {tickets.length === 0 && (
              <TableMessage colSpan={5}>No open tickets. Nice.</TableMessage>
            )}
            {tickets.map((ticket) => (
              <Tr key={ticket.id}>
                <Td>
                  <Link href={`/dashboard/support/${ticket.id}`} className="font-medium text-foreground hover:text-primary-soft">
                    {ticket.subject}
                  </Link>
                </Td>
                <Td>
                  <p>{fullName(ticket.customer)}</p>
                  <p className="text-xs text-muted">{ticket.customer.email}</p>
                </Td>
                <Td className="text-muted">{humanize(ticket.category)}</Td>
                <Td>
                  <StatusBadge status={ticket.status} />
                </Td>
                <Td className="whitespace-nowrap text-right text-muted">{formatRelative(ticket.lastMessageAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
