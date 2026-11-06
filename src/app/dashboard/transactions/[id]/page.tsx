'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '../../../../components/PageHeader';
import { Card, DefinitionList } from '../../../../components/ui/Card';
import { StatusBadge } from '../../../../components/ui/Badge';
import { Alert, Spinner } from '../../../../components/ui/Feedback';
import { api } from '../../../../lib/api';
import { formatAmount, formatDateTime, humanize } from '../../../../lib/format';
import { useRequest } from '../../../../lib/useRequest';
import { TRANSACTION_KIND_LABEL, type AdminTransaction } from '../../../../lib/types';

const mono = (value: string) => <span className="break-all font-mono text-xs">{value}</span>;

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => api.get<AdminTransaction>(`/admin/transactions/${id}`), [id]);
  const { data: tx, error, loading } = useRequest(load, 'Could not load the transaction.');

  const back = (
    <Link href="/dashboard/transactions" className="text-xs font-semibold text-primary-soft hover:underline">
      ← All transactions
    </Link>
  );

  if (error) {
    return (
      <>
        <PageHeader title="Transaction" />
        {back}
        <Alert className="mt-4">{error}</Alert>
      </>
    );
  }
  if (loading || !tx) {
    return (
      <>
        <PageHeader title="Transaction" />
        <Spinner />
      </>
    );
  }

  const items: { label: string; value: React.ReactNode }[] = [
    { label: 'Status', value: <StatusBadge status={tx.status} /> },
    { label: 'Type', value: TRANSACTION_KIND_LABEL[tx.kind] ?? tx.kind },
    { label: 'Amount', value: formatAmount(tx.amount, tx.currency) },
    ...(tx.counterAmount && tx.counterCurrency
      ? [{ label: 'Other side', value: formatAmount(tx.counterAmount, tx.counterCurrency) }]
      : []),
    ...(tx.fee ? [{ label: 'Payments partner fee', value: formatAmount(tx.fee, tx.currency) }] : []),
    ...(tx.partnerFee ? [{ label: 'ZemFi fee', value: formatAmount(tx.partnerFee, tx.currency) }] : []),
    ...(tx.destination ? [{ label: 'Destination', value: tx.destination }] : []),
    ...(tx.network ? [{ label: 'Network', value: tx.network }] : []),
    ...(tx.txHash ? [{ label: 'Transaction hash', value: mono(tx.txHash) }] : []),
    ...(tx.purpose
      ? [{ label: 'Reason for payment', value: `${humanize(tx.purpose)}${tx.purposeNote ? ` — ${tx.purposeNote}` : ''}` }]
      : []),
    ...(tx.failureReason ? [{ label: 'Why it failed', value: tx.failureReason }] : []),
    { label: 'Reference', value: mono(tx.reference) },
    { label: 'Happened', value: formatDateTime(tx.occurredAt) },
    { label: 'Completed', value: tx.completedAt ? formatDateTime(tx.completedAt) : '—' },
    { label: 'Last event', value: mono(tx.lastEvent) },
  ];

  return (
    <>
      <PageHeader
        title={`${TRANSACTION_KIND_LABEL[tx.kind] ?? tx.kind} · ${formatAmount(tx.amount, tx.currency)}`}
        description={formatDateTime(tx.occurredAt)}
      />
      {back}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <div className="p-5">
            <DefinitionList items={items} />
          </div>
        </Card>
        <Card title="Customer">
          <div className="p-5">
            {tx.customer ? (
              <DefinitionList
                items={[
                  {
                    label: 'Name',
                    value: (
                      <Link href={`/dashboard/users/${tx.customer.id}`} className="text-primary-soft hover:underline">
                        {tx.customer.name}
                      </Link>
                    ),
                  },
                  { label: 'Email', value: tx.customer.email },
                  { label: 'Phone', value: tx.customer.phoneNumber || '—' },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">The customer has deleted their account.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
