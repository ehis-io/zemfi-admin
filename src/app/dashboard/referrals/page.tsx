'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Table, TBody, THead, Td, Th, TableMessage, Tr } from '../../../components/ui/Table';
import { useToast } from '../../../components/ui/Toast';
import { useAdmin } from '../../../components/AdminContext';
import { api, friendlyErrorMessage } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import type { ReferralCode } from '../../../lib/types';

type Filter = 'all' | 'agent' | 'customer';

/**
 * Referral codes and who signed up with them. Tracking only: nothing is paid
 * for a referral. Every customer has a code of their own; owners can make
 * codes for agents and campaigns here, and switch any code off (it then stops
 * being accepted at sign-up; past sign-ups keep it).
 */
export default function ReferralsPage() {
  const toast = useToast();
  const { admin } = useAdmin();
  const isOwner = admin.role === 'OWNER';
  const load = useCallback(() => api.get<ReferralCode[]>('/admin/referral-codes'), []);
  const { data: codes, error, loading, setData } = useRequest(load, 'Could not load referral codes.');

  const [filter, setFilter] = useState<Filter>('all');
  const [label, setLabel] = useState('');
  const [custom, setCustom] = useState('');
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    try {
      const made = await api.post<ReferralCode>('/admin/referral-codes', {
        label: label.trim(),
        ...(custom.trim() ? { code: custom.trim() } : {}),
      });
      setData((current) => [made, ...current]);
      setLabel('');
      setCustom('');
      toast.success(`Code ${made.code} made for ${made.label ?? 'the agent'}.`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not make the code.'));
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (code: ReferralCode) => {
    setToggling(code.id);
    try {
      await api.patch(`/admin/referral-codes/${code.id}`, { active: !code.active });
      setData((current) => current.map((c) => (c.id === code.id ? { ...c, active: !code.active } : c)));
      toast.success(`${code.code} is now ${code.active ? 'off' : 'on'}.`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not change the code.'));
    } finally {
      setToggling(null);
    }
  };

  const header = (
    <PageHeader
      title="Referrals"
      description="Who signed up with whose code. Tracking only: nothing is paid for a referral."
    />
  );

  if (error) {
    return (
      <>
        {header}
        <Alert>{error}</Alert>
      </>
    );
  }
  if (loading || !codes) {
    return (
      <>
        {header}
        <Spinner />
      </>
    );
  }

  const shown = codes.filter((c) =>
    filter === 'all' ? true : filter === 'agent' ? !c.owner : Boolean(c.owner),
  );
  const totalSignups = codes.reduce((sum, c) => sum + c.signups, 0);

  return (
    <>
      {header}

      {isOwner && (
        <Card title="Make a code for an agent or campaign" className="mb-6">
          <form onSubmit={create} className="grid gap-3 p-5 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
            <Input
              label="Who or what it is for"
              name="label"
              placeholder="Lagos community, Ada"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
            <Input
              label="Code (optional)"
              name="code"
              placeholder="Made up if blank"
              value={custom}
              maxLength={20}
              onChange={(e) => setCustom(e.target.value.toUpperCase())}
            />
            <Button type="submit" isLoading={creating} disabled={!label.trim()}>
              Make code
            </Button>
          </form>
        </Card>
      )}

      <Card
        title={`${codes.length} codes · ${totalSignups} referred sign-ups`}
        actions={
          <select
            aria-label="Show"
            className="input-field py-1 text-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="all">All codes</option>
            <option value="agent">Agent and campaign codes</option>
            <option value="customer">Customer codes</option>
          </select>
        }
      >
        <Table minWidth={720}>
          <THead>
            <Th>Code</Th>
            <Th>Belongs to</Th>
            <Th className="text-right">Sign-ups</Th>
            <Th>Status</Th>
            <Th>Made</Th>
            {isOwner && <Th />}
          </THead>
          <TBody>
            {shown.length === 0 ? (
              <TableMessage colSpan={isOwner ? 6 : 5}>No codes yet.</TableMessage>
            ) : (
              shown.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-mono">{c.code}</Td>
                  <Td>
                    {c.owner ? (
                      <Link href={`/dashboard/users/${c.owner.id}`} className="text-primary-soft hover:underline">
                        {c.owner.name}
                        <span className="block text-xs text-muted">{c.owner.email}</span>
                      </Link>
                    ) : (
                      <span>
                        {c.label}
                        <span className="block text-xs text-muted">Agent / campaign</span>
                      </span>
                    )}
                  </Td>
                  <Td className="text-right font-semibold">{c.signups}</Td>
                  <Td>{c.active ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>}</Td>
                  <Td className="text-muted">{formatDate(c.createdAt)}</Td>
                  {isOwner && (
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant={c.active ? 'ghost' : 'secondary'}
                        isLoading={toggling === c.id}
                        onClick={() => void toggle(c)}
                      >
                        {c.active ? 'Switch off' : 'Switch on'}
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
