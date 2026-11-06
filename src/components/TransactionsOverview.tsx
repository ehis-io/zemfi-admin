'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from './ui/Card';
import { Alert, Spinner } from './ui/Feedback';
import { TransactionsChart } from './charts/TransactionsChart';
import { api, friendlyErrorMessage } from '../lib/api';
import { formatAmount, formatCompactAmount } from '../lib/format';
import {
  TRANSACTION_KINDS,
  TRANSACTION_KIND_LABEL,
  type SummaryWindow,
  type TransactionTotals,
  type TransactionsSummary,
} from '../lib/types';

const WINDOWS: readonly { value: SummaryWindow; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const OUTCOMES: readonly { key: keyof Omit<TransactionTotals, 'completedAmounts' | 'completedByKind'>; label: string; color?: string; hint?: string }[] = [
  { key: 'total', label: 'Total', color: 'var(--chart-total)', hint: 'every transaction' },
  { key: 'completed', label: 'Completed', color: 'var(--chart-completed)' },
  { key: 'failed', label: 'Failed', color: 'var(--chart-failed)' },
  { key: 'reversed', label: 'Reversed', color: 'var(--chart-reversed)', hint: 'paid out, then returned' },
  { key: 'pending', label: 'Pending', hint: 'not settled yet' },
];

const amountOf = (totals: TransactionTotals, currency: string) =>
  totals.completedAmounts.find((line) => line.currency === currency);

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-background/40 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        {color && <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

/**
 * The Overview's Transactions card: daily counts over 7, 30 or 90 days, and
 * what they add up to, with all time alongside. Loads on its own, so the
 * rest of the Overview never waits on it or fails with it.
 */
export function TransactionsOverview() {
  const [span, setSpan] = useState<SummaryWindow>('30');
  // The span last shown, kept on screen (dimmed) while the next one loads.
  const [previous, setPrevious] = useState<SummaryWindow | null>(null);
  const [loaded, setLoaded] = useState<Partial<Record<SummaryWindow, TransactionsSummary>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<TransactionsSummary>(`/admin/transactions/summary?days=${span}`).then(
      (summary) => {
        if (cancelled) return;
        setLoaded((current) => ({ ...current, [span]: summary }));
        setError(null);
      },
      (err: unknown) => {
        if (!cancelled) setError(friendlyErrorMessage(err, 'Could not load transaction totals.'));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [span]);

  const current = loaded[span];
  const summary = current ?? (previous ? loaded[previous] : undefined);
  const stale = !current;

  const choose = (next: SummaryWindow) => {
    if (next === span) return;
    setPrevious(span);
    setSpan(next);
  };

  const toggle = (
    <div role="group" aria-label="Window" className="inline-flex rounded-lg border border-surface-border p-0.5">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          aria-pressed={w.value === span}
          onClick={() => choose(w.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            w.value === span ? 'bg-surface-raised text-foreground' : 'text-muted hover:text-foreground'
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  );

  return (
    <Card
      className="mt-8"
      title={
        <Link href="/dashboard/transactions" className="hover:text-primary-soft">
          Transactions
        </Link>
      }
      actions={toggle}
    >
      <div className="p-5">
        {error && !summary && <Alert>{error}</Alert>}
        {!error && !summary && <Spinner className="py-10" />}
        {summary && (
          <div className={`transition-opacity ${stale ? 'opacity-50' : ''}`} aria-busy={stale}>
            {error && <Alert className="mb-4">{error}</Alert>}
            <p className="mb-3 text-xs text-muted">
              Per day, last {summary.days} days (Lagos time). Total includes pending.
            </p>
            <TransactionsChart points={summary.series} />

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">
              Last {summary.days} days <span className="font-normal normal-case tracking-normal">· all time below each</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {OUTCOMES.map((o) => (
                <Tile
                  key={o.key}
                  label={o.label}
                  color={o.color}
                  value={summary.window[o.key].toLocaleString()}
                  sub={`${summary.allTime[o.key].toLocaleString()} all time${o.hint ? ` · ${o.hint}` : ''}`}
                />
              ))}
            </div>

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">
              Completed amount <span className="font-normal normal-case tracking-normal">· what customers put in, per currency</span>
            </h3>
            {summary.allTime.completedAmounts.length === 0 ? (
              <p className="text-sm text-muted">No completed transactions yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summary.allTime.completedAmounts.map((all) => {
                  const inWindow = amountOf(summary.window, all.currency);
                  return (
                    <Tile
                      key={all.currency}
                      label={all.currency}
                      value={inWindow ? formatCompactAmount(inWindow.amount, all.currency) : '—'}
                      sub={`${formatAmount(all.amount, all.currency)} all time`}
                    />
                  );
                })}
              </div>
            )}

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">Completed by type</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {TRANSACTION_KINDS.map((kind) => (
                <Tile
                  key={kind}
                  label={TRANSACTION_KIND_LABEL[kind]}
                  value={(summary.window.completedByKind[kind] ?? 0).toLocaleString()}
                  sub={`${(summary.allTime.completedByKind[kind] ?? 0).toLocaleString()} all time`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
