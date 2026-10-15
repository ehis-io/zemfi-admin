'use client';

import React, { useCallback, useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Alert, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { useToast } from '../../../components/ui/Toast';
import { api, friendlyErrorMessage } from '../../../lib/api';
import { formatRelative } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import {
  ANY_CURRENCY,
  FEE_FLOWS,
  FEE_FLOW_HINTS,
  type FeeFlow,
  type FeeRule,
} from '../../../lib/types';

const BPS_IN_A_PERCENT = 100;

/** What the operator has typed but not yet saved, for one rule. */
interface Draft {
  feeBps: string;
  feeFlat: string;
  feeMin: string;
  feeMax: string;
  active: boolean;
}

const draftOf = (rule: FeeRule): Draft => ({
  feeBps: String(rule.feeBps),
  feeFlat: String(rule.feeFlat),
  feeMin: rule.feeMin === null ? '' : String(rule.feeMin),
  feeMax: rule.feeMax === null ? '' : String(rule.feeMax),
  active: rule.active,
});

/** Blank means "no limit", which the API takes as null rather than zero. */
const limitOf = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const numberOf = (value: string): number => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const payloadOf = (draft: Draft) => ({
  feeBps: Math.round(numberOf(draft.feeBps)),
  feeFlat: numberOf(draft.feeFlat),
  feeMin: limitOf(draft.feeMin),
  feeMax: limitOf(draft.feeMax),
  active: draft.active,
});

const isDirty = (rule: FeeRule, draft: Draft): boolean => {
  const next = payloadOf(draft);
  return (
    next.feeBps !== rule.feeBps ||
    next.feeFlat !== rule.feeFlat ||
    next.feeMin !== rule.feeMin ||
    next.feeMax !== rule.feeMax ||
    next.active !== rule.active
  );
};

/** "0.5% + 100, min 50, max 5,000" — the rule in one line. */
const describe = (draft: Draft, currency: string): string => {
  const next = payloadOf(draft);
  const unit = currency === ANY_CURRENCY ? '' : ` ${currency}`;
  const parts: string[] = [];
  if (next.feeBps > 0) parts.push(`${next.feeBps / BPS_IN_A_PERCENT}%`);
  if (next.feeFlat > 0) parts.push(`${next.feeFlat}${unit}`);
  if (parts.length === 0) return 'Charges nothing.';
  let text = parts.join(' + ');
  if (next.feeMin !== null) text += `, min ${next.feeMin}${unit}`;
  if (next.feeMax !== null) text += `, max ${next.feeMax}${unit}`;
  return text;
};

/**
 * ZemFi's own fees, charged on top of whatever Dutchman Bridge charges.
 *
 * A rule does nothing until it is switched on, and every rule is created off
 * at zero — so this page is safe to open and edit, and only the "Charge this"
 * toggle actually starts billing anyone. That direction is confirmed; turning
 * a fee off is not, since stopping charging is never the risky way round.
 *
 * Owner-only, like the API behind it: this is pricing, not an operational
 * switch an agent should be reaching for mid-ticket.
 */
export default function FeesPage() {
  const toast = useToast();
  const loadFees = useCallback(() => api.get<FeeRule[]>('/admin/fees'), []);
  const { data: rules, error, loading, setData, reload } = useRequest(
    loadFees,
    'Could not load the fees.',
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<FeeRule | null>(null);
  const [newFlow, setNewFlow] = useState<FeeFlow>('GLOBAL_SEND');
  const [newCurrency, setNewCurrency] = useState('');
  const [adding, setAdding] = useState(false);

  const draftFor = (rule: FeeRule): Draft => drafts[rule.id] ?? draftOf(rule);

  const editDraft = (rule: FeeRule, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [rule.id]: { ...draftFor(rule), ...patch },
    }));
  };

  const discardDraft = (rule: FeeRule) =>
    setDrafts((current) => {
      const next = { ...current };
      delete next[rule.id];
      return next;
    });

  const save = async (rule: FeeRule) => {
    setSaving(rule.id);
    try {
      const updated = await api.patch<FeeRule>(
        `/admin/fees/${rule.id}`,
        payloadOf(draftFor(rule)),
      );
      setData((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      discardDraft(rule);
      toast.success(
        updated.active
          ? `${updated.label} now charges ${describe(draftOf(updated), updated.currency)}`
          : `${updated.label} charges nothing.`,
      );
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not change the fee.'));
    } finally {
      setSaving(null);
      setConfirming(null);
    }
  };

  /** Starting to charge is confirmed; stopping is not. */
  const requestSave = (rule: FeeRule) => {
    if (!draftFor(rule).active) {
      void save(rule);
      return;
    }
    setConfirming(rule);
  };

  const addRule = async () => {
    const currency = newCurrency.trim().toUpperCase() || ANY_CURRENCY;
    setAdding(true);
    try {
      await api.post<FeeRule>('/admin/fees', { flow: newFlow, currency });
      setNewCurrency('');
      // Re-read rather than append: the API returns the existing rule when one
      // is already there, and the list stays in the backend's order.
      await reload();
      toast.success(`Rule ready for ${newFlow} (${currency}).`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not add the rule.'));
    } finally {
      setAdding(false);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader title="Fees" />
        <Alert>{error}</Alert>
      </>
    );
  }

  if (loading || !rules) {
    return (
      <>
        <PageHeader title="Fees" />
        <Spinner />
      </>
    );
  }

  const charging = rules.filter((rule) => rule.active);

  return (
    <>
      <PageHeader
        title="Fees"
        description="What ZemFi charges on top of our payments partner's own fee. Changes reach every customer immediately."
      />

      {charging.length > 0 && (
        <Alert tone="warning" className="mb-4">
          {charging.length === 1
            ? `${charging[0].label} (${charging[0].currency}) is charging customers.`
            : `${charging.length} fees are charging customers.`}
        </Alert>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="new-flow"
              className="text-[10px] font-bold uppercase tracking-wider text-muted"
            >
              Transaction kind
            </label>
            <select
              id="new-flow"
              className="input-field"
              value={newFlow}
              onChange={(event) => setNewFlow(event.target.value as FeeFlow)}
            >
              {FEE_FLOWS.map((flow) => (
                <option key={flow} value={flow}>
                  {flow}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">{FEE_FLOW_HINTS[newFlow]}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="new-currency"
              className="text-[10px] font-bold uppercase tracking-wider text-muted"
            >
              Currency
            </label>
            <input
              id="new-currency"
              className="input-field"
              placeholder={ANY_CURRENCY}
              value={newCurrency}
              onChange={(event) => setNewCurrency(event.target.value)}
            />
            <p className="text-xs text-muted">Blank covers every currency.</p>
          </div>
          <Button size="sm" isLoading={adding} onClick={() => void addRule()}>
            Add rule
          </Button>
        </div>
      </Card>

      <Card>
        {rules.length === 0 ? (
          <EmptyState>
            No fees configured. ZemFi charges nothing beyond our payments partner&apos;s own fee.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-surface-border">
            {rules.map((rule) => {
              const draft = draftFor(rule);
              const dirty = isDirty(rule, draft);
              return (
                <li key={rule.id} className="fade-in px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{rule.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted">
                        {rule.flow} · {rule.currency}
                      </p>
                    </div>
                    <Badge tone={rule.active ? 'danger' : 'neutral'}>
                      {rule.active ? 'Charging' : 'Off'}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    {(
                      [
                        ['feeBps', 'Percent (bps)', '50 = 0.50%'],
                        ['feeFlat', 'Fixed', 'Added to the percentage'],
                        ['feeMin', 'Minimum', 'Blank for none'],
                        ['feeMax', 'Maximum', 'Blank for none'],
                      ] as const
                    ).map(([field, label, hint]) => (
                      <div key={field} className="flex flex-col gap-1">
                        <label
                          htmlFor={`${field}-${rule.id}`}
                          className="text-[10px] font-bold uppercase tracking-wider text-muted"
                        >
                          {label}
                        </label>
                        <input
                          id={`${field}-${rule.id}`}
                          className="input-field"
                          inputMode="decimal"
                          value={draft[field]}
                          onChange={(event) =>
                            editDraft(rule, { [field]: event.target.value } as Partial<Draft>)
                          }
                        />
                        <p className="text-xs text-muted">{hint}</p>
                      </div>
                    ))}
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(event) => editDraft(rule, { active: event.target.checked })}
                    />
                    Charge this fee
                  </label>

                  <p className="mt-2 text-xs text-muted">
                    {draft.active ? describe(draft, rule.currency) : 'Charges nothing while off.'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">
                      {rule.updatedAt
                        ? `Changed by ${rule.updatedByName ?? 'a former admin'} ${formatRelative(
                            rule.updatedAt,
                          )}`
                        : 'Never changed.'}
                    </p>
                    {dirty && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => discardDraft(rule)}
                          disabled={saving === rule.id}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant={draft.active ? 'danger' : 'primary'}
                          isLoading={saving === rule.id}
                          onClick={() => requestSave(rule)}
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirming !== null}
        tone="danger"
        title={confirming ? `Charge customers for "${confirming.label}"?` : ''}
        description={
          confirming ? (
            <>
              <p>
                Every {confirming.currency === ANY_CURRENCY ? '' : `${confirming.currency} `}
                transaction of this kind is charged immediately, on top of our payments partner&apos;s own fee.
              </p>
              <p className="mt-2">
                They will pay:{' '}
                <span className="text-foreground">
                  {describe(draftFor(confirming), confirming.currency)}
                </span>
              </p>
            </>
          ) : null
        }
        confirmLabel="Start charging"
        busy={saving !== null}
        onConfirm={() => confirming && void save(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
