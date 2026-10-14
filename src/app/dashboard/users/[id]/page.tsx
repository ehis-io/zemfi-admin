'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '../../../../components/PageHeader';
import { Card, DefinitionList } from '../../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Alert, EmptyState, Spinner } from '../../../../components/ui/Feedback';
import { Table, TBody, Td, Th, THead, Tr, TableMessage } from '../../../../components/ui/Table';
import { useToast } from '../../../../components/ui/Toast';
import { api, friendlyErrorMessage, query } from '../../../../lib/api';
import { formatAmount, formatDateTime, fullName, humanize } from '../../../../lib/format';
import { useRequest } from '../../../../lib/useRequest';
import type {
  KycRecord,
  KycRefreshResult,
  KycReverification,
  Page,
  TwoFactorResetResult,
  UserDetail,
  Withdrawal,
} from '../../../../lib/types';

const WITHDRAWALS_PAGE = 20;

/** One international enrolment group, as Bridge reports it. */
interface InternationalGroup {
  key: string;
  status: string;
  reason: string | null;
  countries: string[];
  optedInCountries?: string[];
}

const GROUP_LABEL: Record<string, string> = {
  americas_europe: 'US, Europe & Americas',
  china: 'China',
};

/** Groups whose partner can be sent the details again from here. */
const RESENDABLE_GROUPS = new Set(['china']);

const asGroups = (value: unknown): InternationalGroup[] => {
  const groups = (value as { groups?: unknown } | null)?.groups;
  return Array.isArray(groups) ? (groups as InternationalGroup[]) : [];
};

/**
 * The backend types the Bridge-side reverification as `unknown`; render it
 * only when it happens to have the same shape as the user's own record.
 */
const asReverification = (value: unknown): KycReverification | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { items?: unknown; message?: unknown };
  if (!Array.isArray(candidate.items)) return null;
  const items = candidate.items.filter((item): item is string => typeof item === 'string');
  const message = typeof candidate.message === 'string' ? candidate.message : null;
  return { items, message };
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [withdrawalsMore, setWithdrawalsMore] = useState(false);
  const [withdrawalsMoreError, setWithdrawalsMoreError] = useState<string | null>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resendGroup, setResendGroup] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendPostalCode, setResendPostalCode] = useState('');

  const loadInternational = useCallback(
    () => api.get<unknown>(`/admin/users/${id}/international`),
    [id],
  );
  const {
    data: international,
    error: internationalError,
    setData: setInternational,
  } = useRequest(loadInternational, 'Could not load international verification.');
  const groups = asGroups(international);

  const loadDetail = useCallback(() => api.get<UserDetail>(`/admin/users/${id}`), [id]);
  const {
    data: detail,
    error,
    setData: setDetail,
    reload: reloadDetail,
  } = useRequest(loadDetail, 'Could not load this user.');

  const loadWithdrawals = useCallback(
    () => api.get<Page<Withdrawal>>(`/admin/users/${id}/withdrawals${query({ limit: WITHDRAWALS_PAGE })}`),
    [id],
  );
  const {
    data: withdrawalsPage,
    error: withdrawalsError,
    loading: withdrawalsLoading,
    setData: setWithdrawalsPage,
  } = useRequest(loadWithdrawals, 'Could not load withdrawals.');
  const withdrawals = withdrawalsPage?.items ?? [];
  const withdrawalsCursor = withdrawalsPage?.nextCursor ?? null;

  const loadMoreWithdrawals = async () => {
    if (!withdrawalsCursor) return;
    setWithdrawalsMore(true);
    setWithdrawalsMoreError(null);
    try {
      const page = await api.get<Page<Withdrawal>>(
        `/admin/users/${id}/withdrawals${query({ limit: WITHDRAWALS_PAGE, cursor: withdrawalsCursor })}`,
      );
      setWithdrawalsPage((current) => ({
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
      }));
    } catch (err: unknown) {
      setWithdrawalsMoreError(friendlyErrorMessage(err, 'Could not load more withdrawals.'));
    } finally {
      setWithdrawalsMore(false);
    }
  };

  const resetTwoFactor = async () => {
    setResetting(true);
    try {
      const result = await api.post<TwoFactorResetResult>(`/admin/users/${id}/2fa/reset`);
      setDetail((current) => ({
        ...current,
        user: { ...current.user, twoFactorEnabled: result.twoFactorEnabled },
      }));
      toast.success('Two-factor authentication has been reset.');
      setConfirmReset(false);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not reset two-factor authentication.'));
    } finally {
      setResetting(false);
    }
  };

  // Have Bridge send the user's address, document and selfie to the group's
  // partner again, when it reports them missing and the user cannot re-submit.
  const resendInternational = async () => {
    if (!resendGroup) return;
    setResending(true);
    try {
      const postalCode = resendPostalCode.trim();
      const result = await api.post<unknown>(
        `/admin/users/${id}/international/${resendGroup}/resend`,
        postalCode ? { postalCode } : {},
      );
      setInternational(() => result);
      toast.success('Verification details re-sent.');
      setResendGroup(null);
      setResendPostalCode('');
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not re-send the details.'));
    } finally {
      setResending(false);
    }
  };

  const refreshKyc = async () => {
    setRefreshing(true);
    try {
      const result = await api.post<KycRefreshResult>(`/admin/users/${id}/kyc/refresh`);
      // Show the fresh records straight away, then re-fetch the whole detail
      // so the synced-at stamp and the Bridge snapshot agree with them.
      setDetail((current) => ({
        ...current,
        user: {
          ...current.user,
          kycRecords: result.records,
          kycReverification: asReverification(result.reverification),
        },
      }));
      await reloadDetail();
      toast.success('KYC records refreshed from Bridge.');
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not refresh KYC.'));
    } finally {
      setRefreshing(false);
    }
  };

  if (error) {
    return (
      <>
        <BackLink />
        <PageHeader title="User" />
        <Alert>{error}</Alert>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <BackLink />
        <PageHeader title="User" />
        <Spinner />
      </>
    );
  }

  const { user, bridge, bridgeError } = detail;
  const kycRecords: KycRecord[] = bridge?.kyc.records ?? user.kycRecords ?? [];
  const reverification = user.kycReverification ?? asReverification(bridge?.kyc.reverification);

  return (
    <>
      <BackLink />
      <PageHeader
        title={fullName(user)}
        description={user.email}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={refreshKyc}
              isLoading={refreshing}
              disabled={!user.dutchmanCustomerId}
              title={user.dutchmanCustomerId ? undefined : 'This user has no Bridge customer yet.'}
            >
              Refresh KYC
            </Button>
            <Button variant="danger" onClick={() => setConfirmReset(true)} disabled={!user.twoFactorEnabled}>
              Reset 2FA
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Profile" className="lg:col-span-1">
          <div className="p-5">
            <DefinitionList
              items={[
                { label: 'User ID', value: <span className="font-mono text-xs">{user.id}</span> },
                { label: 'Phone', value: user.phoneNumber || '—' },
                { label: 'Country', value: user.country || '—' },
                {
                  label: 'Two-factor',
                  value: user.twoFactorEnabled ? <Badge tone="info">Enabled</Badge> : <Badge>Disabled</Badge>,
                },
                {
                  label: 'Bridge customer',
                  value: user.dutchmanCustomerId ? (
                    <span className="font-mono text-xs">{user.dutchmanCustomerId}</span>
                  ) : (
                    <Badge>Not linked</Badge>
                  ),
                },
                { label: 'KYC synced', value: formatDateTime(user.kycCacheSyncedAt) },
                { label: 'Joined', value: formatDateTime(user.createdAt) },
              ]}
            />
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {bridgeError && (
            <Alert tone="warning">
              <span className="font-semibold">Bridge unavailable:</span> {bridgeError}
              {user.kycRecords && ' Showing the last cached KYC records.'}
            </Alert>
          )}

          {reverification && reverification.items.length > 0 && (
            <Alert tone="warning">
              <p className="font-semibold">Re-verification requested</p>
              <p className="mt-1">
                Items: {reverification.items.map((item) => humanize(item)).join(', ')}
              </p>
              {reverification.message && <p className="mt-1 italic">“{reverification.message}”</p>}
            </Alert>
          )}

          <Card title="KYC records">
            <Table minWidth={560}>
              <THead>
                <Th>Level</Th>
                <Th>Status</Th>
                <Th>ID type</Th>
                <Th>Rejection reason</Th>
                <Th className="text-right">Submitted</Th>
              </THead>
              <TBody>
                {kycRecords.length === 0 && (
                  <TableMessage colSpan={5}>No KYC records.</TableMessage>
                )}
                {kycRecords.map((record) => (
                  <Tr key={record.id}>
                    <Td className="font-medium">Tier {record.level}</Td>
                    <Td>
                      <StatusBadge status={record.status} />
                    </Td>
                    <Td className="text-muted">{record.idType ? humanize(record.idType) : '—'}</Td>
                    <Td className="text-muted">{record.rejectionReason ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-right text-muted">{formatDateTime(record.createdAt)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card title="International verification">
            {internationalError ? (
              <div className="p-5">
                <Alert>{internationalError}</Alert>
              </div>
            ) : (
              <Table minWidth={560}>
                <THead>
                  <Th>Destinations</Th>
                  <Th>Status</Th>
                  <Th>Reason</Th>
                  <Th>Opted into</Th>
                  <Th className="text-right">Action</Th>
                </THead>
                <TBody>
                  {groups.length === 0 && (
                    <TableMessage colSpan={5}>
                      {international ? 'No international enrolment.' : 'Loading…'}
                    </TableMessage>
                  )}
                  {groups.map((group) => (
                    <Tr key={group.key}>
                      <Td className="font-medium">{GROUP_LABEL[group.key] ?? humanize(group.key)}</Td>
                      <Td>
                        <StatusBadge status={group.status} />
                      </Td>
                      <Td className="text-muted">{group.reason ?? '—'}</Td>
                      <Td className="text-muted">
                        {group.optedInCountries?.length ? group.optedInCountries.join(', ') : '—'}
                      </Td>
                      <Td className="text-right">
                        {RESENDABLE_GROUPS.has(group.key) &&
                        group.status !== 'APPROVED' &&
                        group.status !== 'NOT_STARTED' ? (
                          <Button variant="secondary" onClick={() => setResendGroup(group.key)}>
                            Resend details
                          </Button>
                        ) : (
                          '—'
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          {bridge && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card title="Balances">
                {bridge.wallet.balances.length === 0 ? (
                  <EmptyState>No balances.</EmptyState>
                ) : (
                  <ul className="divide-y divide-surface-border">
                    {bridge.wallet.balances.map((balance) => (
                      <li key={balance.currency} className="flex items-center justify-between px-5 py-3">
                        <span className="font-semibold">{balance.currency}</span>
                        <span className="font-mono text-sm tabular-nums">
                          {formatAmount(balance.balance, balance.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Virtual account">
                {bridge.wallet.virtualAccount ? (
                  <div className="p-5">
                    <DefinitionList
                      items={[
                        { label: 'Bank', value: bridge.wallet.virtualAccount.bankName },
                        {
                          label: 'Account number',
                          value: <span className="font-mono">{bridge.wallet.virtualAccount.accountNumber}</span>,
                        },
                        { label: 'Account name', value: bridge.wallet.virtualAccount.accountName },
                        { label: 'Currency', value: bridge.wallet.virtualAccount.currency },
                        { label: 'Bank code', value: bridge.wallet.virtualAccount.bankCode },
                        { label: 'Status', value: <StatusBadge status={bridge.wallet.virtualAccount.status} /> },
                      ]}
                    />
                  </div>
                ) : (
                  <EmptyState>No virtual account.</EmptyState>
                )}
              </Card>

              <Card title="Deposit addresses" className="md:col-span-2">
                {bridge.wallet.addresses.length === 0 ? (
                  <EmptyState>No deposit addresses.</EmptyState>
                ) : (
                  <ul className="divide-y divide-surface-border">
                    {bridge.wallet.addresses.map((entry) => (
                      <li key={`${entry.network}:${entry.address}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <Badge tone="info">{entry.network}</Badge>
                        <code className="break-all font-mono text-xs text-muted">{entry.address}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      <Card title="Withdrawals" className="mt-6">
        {(withdrawalsError ?? withdrawalsMoreError) && (
          <div className="p-4">
            <Alert>{withdrawalsError ?? withdrawalsMoreError}</Alert>
          </div>
        )}
        <Table minWidth={760}>
          <THead>
            <Th>Reference</Th>
            <Th>Amount</Th>
            <Th>Status</Th>
            <Th>Bank account</Th>
            <Th>Failure reason</Th>
            <Th className="text-right">Date</Th>
          </THead>
          <TBody>
            {withdrawalsLoading && <TableMessage colSpan={6}>Loading withdrawals…</TableMessage>}
            {!withdrawalsLoading && withdrawals.length === 0 && (
              <TableMessage colSpan={6}>No withdrawals.</TableMessage>
            )}
            {!withdrawalsLoading &&
              withdrawals.map((withdrawal) => (
                <Tr key={withdrawal.id}>
                  <Td className="font-mono text-xs">{withdrawal.reference}</Td>
                  <Td className="whitespace-nowrap font-mono tabular-nums">
                    {formatAmount(withdrawal.amount, withdrawal.currency)}
                  </Td>
                  <Td>
                    <StatusBadge status={withdrawal.status} />
                  </Td>
                  <Td className="text-muted">
                    {withdrawal.bankAccount ? (
                      <>
                        <p className="text-foreground">{withdrawal.bankAccount.bankName}</p>
                        <p className="text-xs">
                          {withdrawal.bankAccount.accountName} · ••••{withdrawal.bankAccount.accountNumberLast4}
                        </p>
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="text-muted">{withdrawal.failureReason ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-right text-muted">{formatDateTime(withdrawal.createdAt)}</Td>
                </Tr>
              ))}
          </TBody>
        </Table>
        {withdrawalsCursor && !withdrawalsLoading && (
          <div className="border-t border-surface-border px-4 py-3 text-center">
            <Button variant="secondary" size="sm" onClick={loadMoreWithdrawals} isLoading={withdrawalsMore}>
              Load more
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Reset two-factor authentication?"
        description={
          <>
            This removes the authenticator app from <strong>{fullName(user)}</strong>&apos;s account. They will be
            able to sign in with just their password until they set 2FA up again. Only do this after you
            have verified their identity.
          </>
        }
        confirmLabel="Reset 2FA"
        tone="danger"
        busy={resetting}
        onConfirm={resetTwoFactor}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        open={resendGroup !== null}
        title="Re-send verification details?"
        description={
          <>
            Sends <strong>{fullName(user)}</strong>&apos;s residential address, ID document and selfie to our{' '}
            {GROUP_LABEL[resendGroup ?? ''] ?? 'international'} payout partner again, to complete their review. No fee
            is charged.
            <div className="mt-4">
              <Input
                label="Postal code (if the partner asks for one)"
                name="resend-postal-code"
                value={resendPostalCode}
                onChange={(e) => setResendPostalCode(e.target.value)}
                placeholder="e.g. 100001 — confirm it with the customer"
                maxLength={16}
              />
            </div>
          </>
        }
        confirmLabel="Re-send"
        tone="primary"
        busy={resending}
        onConfirm={resendInternational}
        onCancel={() => {
          setResendGroup(null);
          setResendPostalCode('');
        }}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/users" className="mb-3 inline-block text-xs font-semibold text-muted hover:text-foreground">
      ← All users
    </Link>
  );
}
