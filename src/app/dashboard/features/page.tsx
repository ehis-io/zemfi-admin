'use client';

import React, { useCallback, useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Alert, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { useToast } from '../../../components/ui/Toast';
import { api, friendlyErrorMessage } from '../../../lib/api';
import { formatRelative, humanize } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import {
  FEATURE_STATUSES,
  FEATURE_STATUS_HINTS,
  type Feature,
  type FeatureStatus,
} from '../../../lib/types';

const MESSAGE_MAX = 300;

/** What the operator has typed but not yet saved, for one switch. */
interface Draft {
  status: FeatureStatus;
  message: string;
}

const draftOf = (feature: Feature): Draft => ({
  status: feature.status,
  message: feature.message ?? '',
});

/**
 * A message only exists while a capability is unavailable, so switching back
 * to LIVE clears it rather than leaving yesterday's outage notice stored.
 */
const messageFor = (draft: Draft): string | undefined =>
  draft.status === 'LIVE' ? undefined : draft.message.trim() || undefined;

const isDirty = (feature: Feature, draft: Draft): boolean =>
  draft.status !== feature.status ||
  (messageFor(draft) ?? null) !== (feature.message ?? null);

/**
 * ZemFi's own kill switches. The backend has served these all along
 * (GET/PATCH /admin/features); until this page existed, throwing one meant
 * calling the API by hand, which is not something to be doing during an
 * incident.
 *
 * A change takes effect immediately for every customer, so the risky
 * direction -- taking a capability away -- is confirmed first. Restoring one
 * is not: that is the end of an outage, and should never be slowed down.
 */
export default function FeaturesPage() {
  const toast = useToast();
  const loadFeatures = useCallback(() => api.get<Feature[]>('/admin/features'), []);
  const { data: features, error, loading, setData } = useRequest(loadFeatures, 'Could not load the switches.');

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Feature | null>(null);

  const draftFor = (feature: Feature): Draft => drafts[feature.key] ?? draftOf(feature);

  const editDraft = (feature: Feature, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [feature.key]: { ...draftFor(feature), ...patch },
    }));
  };

  const save = async (feature: Feature) => {
    const draft = draftFor(feature);
    setSaving(feature.key);
    try {
      const updated = await api.patch<Feature>(`/admin/features/${feature.key}`, {
        status: draft.status,
        message: messageFor(draft),
      });
      setData((current) => current.map((item) => (item.key === updated.key ? updated : item)));
      // Drop the draft so the row goes back to mirroring the server.
      setDrafts((current) => {
        const next = { ...current };
        delete next[feature.key];
        return next;
      });
      toast.success(`${feature.label} is now ${humanize(updated.status).toLowerCase()}.`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not change the switch.'));
    } finally {
      setSaving(null);
      setConfirming(null);
    }
  };

  /** Taking a capability away is confirmed; giving one back is not. */
  const requestSave = (feature: Feature) => {
    if (draftFor(feature).status === 'LIVE') {
      void save(feature);
      return;
    }
    setConfirming(feature);
  };

  if (error) {
    return (
      <>
        <PageHeader title="Features" />
        <Alert>{error}</Alert>
      </>
    );
  }

  if (loading || !features) {
    return (
      <>
        <PageHeader title="Features" />
        <Spinner />
      </>
    );
  }

  const degraded = features.filter((feature) => feature.status !== 'LIVE');

  return (
    <>
      <PageHeader
        title="Features"
        description="What the app may offer right now. Changes reach every customer immediately."
      />

      {degraded.length > 0 && (
        <Alert tone="warning" className="mb-4">
          {degraded.length === 1
            ? `${degraded[0].label} is not live.`
            : `${degraded.length} capabilities are not live: ${degraded
                .map((feature) => feature.label)
                .join(', ')}.`}
        </Alert>
      )}

      <Card>
        {features.length === 0 ? (
          <EmptyState>No switchable capabilities.</EmptyState>
        ) : (
          <ul className="divide-y divide-surface-border">
            {features.map((feature) => {
              const draft = draftFor(feature);
              const dirty = isDirty(feature, draft);
              const statusId = `status-${feature.key}`;
              const messageId = `message-${feature.key}`;
              return (
                <li key={feature.key} className="fade-in px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{feature.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted">{feature.key}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Only worth saying for COMING_SOON, where the word
                          suggests a soft "on": the backend lets nothing
                          through but LIVE. Next to OFF it says nothing. */}
                      {feature.status === 'COMING_SOON' && <Badge tone="danger">Unusable</Badge>}
                      <StatusBadge status={feature.status} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={statusId}
                        className="text-[10px] font-bold uppercase tracking-wider text-muted"
                      >
                        State
                      </label>
                      <select
                        id={statusId}
                        className="input-field"
                        value={draft.status}
                        onChange={(event) =>
                          editDraft(feature, { status: event.target.value as FeatureStatus })
                        }
                      >
                        {FEATURE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {humanize(status)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted">{FEATURE_STATUS_HINTS[draft.status]}</p>
                    </div>

                    {draft.status !== 'LIVE' && (
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={messageId}
                          className="text-[10px] font-bold uppercase tracking-wider text-muted"
                        >
                          What customers are told
                        </label>
                        <textarea
                          id={messageId}
                          rows={2}
                          maxLength={MESSAGE_MAX}
                          className="input-field resize-y"
                          placeholder="Withdrawals are paused while our bank completes maintenance."
                          value={draft.message}
                          onChange={(event) => editDraft(feature, { message: event.target.value })}
                        />
                        <p className="text-xs text-muted">
                          {draft.message.trim()
                            ? `${draft.message.length}/${MESSAGE_MAX}`
                            : 'Without a message the app can only show a generic error.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">
                      {feature.updatedAt
                        ? `Changed by ${feature.updatedByName ?? 'a former admin'} ${formatRelative(
                            feature.updatedAt,
                          )}`
                        : 'Never changed.'}
                    </p>
                    {dirty && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDrafts((current) => {
                              const next = { ...current };
                              delete next[feature.key];
                              return next;
                            })
                          }
                          disabled={saving === feature.key}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant={draft.status === 'LIVE' ? 'primary' : 'danger'}
                          isLoading={saving === feature.key}
                          onClick={() => requestSave(feature)}
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
        title={
          confirming ? `Take "${confirming.label}" away from customers?` : ''
        }
        description={
          confirming ? (
            <>
              <p>
                Every customer loses this immediately, and anyone part-way through will be
                stopped.
              </p>
              <p className="mt-2">
                They will be told:{' '}
                <span className="text-foreground">
                  {messageFor(draftFor(confirming)) ?? 'nothing — only a generic error.'}
                </span>
              </p>
            </>
          ) : null
        }
        confirmLabel={
          confirming ? `Set ${humanize(draftFor(confirming).status).toLowerCase()}` : 'Confirm'
        }
        busy={saving !== null}
        onConfirm={() => confirming && void save(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
