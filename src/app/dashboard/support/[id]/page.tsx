'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '../../../../components/PageHeader';
import { Card, DefinitionList } from '../../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Alert, EmptyState, Spinner } from '../../../../components/ui/Feedback';
import { useToast } from '../../../../components/ui/Toast';
import { api, friendlyErrorMessage } from '../../../../lib/api';
import { formatDateTime, fullName, humanize } from '../../../../lib/format';
import { useRequest } from '../../../../lib/useRequest';
import {
  TICKET_STATUSES,
  type Ticket,
  type TicketDetail,
  type TicketMessage,
  type TicketStatus,
} from '../../../../lib/types';

const isTicketStatus = (value: string): value is TicketStatus =>
  (TICKET_STATUSES as readonly string[]).includes(value);

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const threadEnd = useRef<HTMLDivElement | null>(null);

  const loadTicket = useCallback(() => api.get<TicketDetail>(`/admin/support/tickets/${id}`), [id]);
  const { data: detail, error, setData: setDetail } = useRequest(loadTicket, 'Could not load this ticket.');

  // Keep the newest message in view as the thread grows.
  const messageCount = detail?.messages.length ?? 0;
  useEffect(() => {
    if (messageCount > 0) threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [messageCount]);

  const sendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body) return;
    setSending(true);
    try {
      const message = await api.post<TicketMessage>(`/admin/support/tickets/${id}/reply`, { body });
      setDetail((current) => ({
        ...current,
        messages: [...current.messages, message],
        ticket: { ...current.ticket, lastMessageAt: message.createdAt },
      }));
      setReply('');
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not send the reply.'));
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: TicketStatus) => {
    if (!detail || status === detail.ticket.status) return;
    setChangingStatus(true);
    try {
      const ticket = await api.post<Ticket>(`/admin/support/tickets/${id}/status`, { status });
      setDetail((current) => ({ ...current, ticket }));
      toast.success(`Ticket marked ${humanize(ticket.status).toLowerCase()}.`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not change the status.'));
    } finally {
      setChangingStatus(false);
    }
  };

  if (error) {
    return (
      <>
        <BackLink />
        <PageHeader title="Ticket" />
        <Alert>{error}</Alert>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <BackLink />
        <PageHeader title="Ticket" />
        <Spinner />
      </>
    );
  }

  const { ticket, customer, messages } = detail;
  const canReply = ticket.status !== 'CLOSED';

  return (
    <>
      <BackLink />
      <PageHeader
        title={ticket.subject}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge>{humanize(ticket.category)}</Badge>
            <StatusBadge status={ticket.status} />
            <span>Opened {formatDateTime(ticket.createdAt)}</span>
          </span>
        }
        actions={
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Status
            <select
              className="input-field w-auto"
              value={ticket.status}
              disabled={changingStatus}
              onChange={(event) => {
                const next = event.target.value;
                if (isTicketStatus(next)) void changeStatus(next);
              }}
            >
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Conversation">
            {messages.length === 0 ? (
              <EmptyState>No messages yet.</EmptyState>
            ) : (
              <ol className="flex flex-col gap-3 p-5">
                {messages.map((message) => {
                  const admin = message.authorType === 'ADMIN';
                  return (
                    <li key={message.id} className={`flex ${admin ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                          admin
                            ? 'rounded-br-sm bg-primary text-white'
                            : 'rounded-bl-sm border border-surface-border bg-surface-raised text-foreground'
                        }`}
                      >
                        <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${admin ? 'text-white/70' : 'text-muted'}`}>
                          {message.authorName} · {formatDateTime(message.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      </div>
                    </li>
                  );
                })}
                <div ref={threadEnd} />
              </ol>
            )}

            <form onSubmit={sendReply} className="border-t border-surface-border p-4">
              <label htmlFor="reply" className="sr-only">
                Reply
              </label>
              <textarea
                id="reply"
                className="input-field min-h-28 resize-y"
                placeholder={canReply ? 'Write a reply to the customer…' : 'This ticket is closed. Reopen it to reply.'}
                value={reply}
                disabled={!canReply || sending}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">Ctrl/⌘ + Enter to send.</p>
                <Button type="submit" isLoading={sending} disabled={!canReply || reply.trim().length === 0}>
                  Send reply
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <div className="p-5">
              <DefinitionList
                items={[
                  {
                    label: 'Name',
                    value: (
                      <Link href={`/dashboard/users/${customer.id}`} className="font-medium text-primary-soft hover:underline">
                        {fullName(customer)}
                      </Link>
                    ),
                  },
                  { label: 'Email', value: customer.email },
                ]}
              />
              <Link
                href={`/dashboard/users/${customer.id}`}
                className="mt-4 inline-block text-xs font-semibold text-primary-soft hover:underline"
              >
                Open user profile →
              </Link>
            </div>
          </Card>

          <Card title="Details">
            <div className="p-5">
              <DefinitionList
                items={[
                  { label: 'Ticket ID', value: <span className="font-mono text-xs">{ticket.id}</span> },
                  {
                    label: 'Transaction ref',
                    value: ticket.transactionReference ? (
                      <span className="font-mono text-xs">{ticket.transactionReference}</span>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'Last activity', value: formatDateTime(ticket.lastMessageAt) },
                  { label: 'Customer last read', value: formatDateTime(ticket.userLastReadAt) },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/support" className="mb-3 inline-block text-xs font-semibold text-muted hover:text-foreground">
      ← All tickets
    </Link>
  );
}
