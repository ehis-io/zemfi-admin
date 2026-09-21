'use client';

import React, { useCallback, useState } from 'react';
import { useAdmin } from '../../../components/AdminContext';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Table, TBody, Td, Th, THead, Tr, TableMessage } from '../../../components/ui/Table';
import { useToast } from '../../../components/ui/Toast';
import { api, friendlyErrorMessage } from '../../../lib/api';
import { formatDate, formatRelative, humanize } from '../../../lib/format';
import { useRequest } from '../../../lib/useRequest';
import {
  ADMIN_ROLES,
  ADMIN_ROLE_HINTS,
  MIN_ADMIN_PASSWORD_LENGTH,
  type AdminAccount,
  type AdminRole,
} from '../../../lib/types';

const BLANK_FORM = { email: '', name: '', password: '', role: 'AGENT' as AdminRole };

/**
 * Staff accounts. Owner-only, and the backend enforces that too -- this page
 * hiding itself from an agent is a courtesy, not the control.
 *
 * Nobody is ever deleted: support replies are attributed to their author, so
 * an account is deactivated instead, which the API applies to their next
 * request.
 */
export default function AdminsPage() {
  const { admin: me } = useAdmin();
  const toast = useToast();
  const isOwner = me.role === 'OWNER';
  // An agent gets the refusal below without asking the server first: the
  // request could only ever come back 403, and hooks run before that render.
  const loadAdmins = useCallback(
    () => (isOwner ? api.get<AdminAccount[]>('/admin/admins') : Promise.resolve([])),
    [isOwner],
  );
  const { data: admins, error, loading, setData, reload } = useRequest(
    loadAdmins,
    'Could not load the admins.',
  );

  const [form, setForm] = useState(BLANK_FORM);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<AdminAccount | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const replace = (updated: AdminAccount) =>
    setData((current) => current.map((row) => (row.id === updated.id ? updated : row)));

  const addAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    try {
      await api.post<AdminAccount>('/admin/admins', {
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      });
      setForm(BLANK_FORM);
      // Refetched rather than appended: the list is ordered (active first,
      // then by name), and guessing where the new row belongs would show it
      // in the wrong place until the next load.
      await reload();
      toast.success('Admin added.');
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not add the admin.'));
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (account: AdminAccount, role: AdminRole) => {
    if (role === account.role) return;
    setBusyId(account.id);
    try {
      replace(await api.patch<AdminAccount>(`/admin/admins/${account.id}`, { role }));
      toast.success(`${account.name} is now ${humanize(role).toLowerCase()}.`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not change the role.'));
    } finally {
      setBusyId(null);
    }
  };

  const setActive = async (account: AdminAccount, active: boolean) => {
    setBusyId(account.id);
    try {
      replace(await api.patch<AdminAccount>(`/admin/admins/${account.id}`, { active }));
      toast.success(active ? `${account.name} can sign in again.` : `${account.name} is deactivated.`);
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not change their access.'));
    } finally {
      setBusyId(null);
      setDeactivating(null);
    }
  };

  const savePassword = async () => {
    if (!passwordFor) return;
    setBusyId(passwordFor.id);
    try {
      await api.post(`/admin/admins/${passwordFor.id}/password`, { password: newPassword });
      toast.success(`Password set for ${passwordFor.name}. Tell them in person, not by email.`);
      setPasswordFor(null);
      setNewPassword('');
    } catch (err: unknown) {
      toast.error(friendlyErrorMessage(err, 'Could not set the password.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!isOwner) {
    return (
      <>
        <PageHeader title="Admins" />
        <Alert tone="info">Only an owner can manage admin accounts.</Alert>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Admins" />
        <Alert>{error}</Alert>
      </>
    );
  }

  const formValid =
    form.email.includes('@') &&
    form.name.trim().length > 0 &&
    form.password.length >= MIN_ADMIN_PASSWORD_LENGTH;

  return (
    <>
      <PageHeader title="Admins" description="Who can sign in to this console." />

      <Card title="Add an admin">
        <form onSubmit={addAdmin} className="grid gap-4 p-5 sm:grid-cols-2">
          <Input
            label="Email"
            name="new-admin-email"
            type="email"
            autoComplete="off"
            placeholder="ops@railz.example"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            label="Name"
            name="new-admin-name"
            autoComplete="off"
            placeholder="Ada Operator"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <PasswordInput
            label={`Password (at least ${MIN_ADMIN_PASSWORD_LENGTH} characters)`}
            name="new-admin-password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <div className="flex w-full flex-col gap-1">
            <label
              htmlFor="new-admin-role"
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Role
            </label>
            <select
              id="new-admin-role"
              className="input-field"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {humanize(role)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">{ADMIN_ROLE_HINTS[form.role]}</p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" isLoading={adding} disabled={!formValid}>
              Add admin
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <Table minWidth={760}>
          <THead>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Last signed in</Th>
            <Th>Added</Th>
            <Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading && (
              <TableMessage colSpan={5}>
                <Spinner className="py-0" />
              </TableMessage>
            )}
            {!loading && admins?.length === 0 && (
              <TableMessage colSpan={5}>No admins.</TableMessage>
            )}
            {admins?.map((account) => {
              const isMe = account.id === me.id;
              const busy = busyId === account.id;
              return (
                <Tr key={account.id} className={account.active ? '' : 'opacity-60'}>
                  <Td>
                    <p className="font-medium text-foreground">
                      {account.name}
                      {isMe && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{account.email}</p>
                    {!account.active && (
                      <Badge tone="danger" className="mt-1">
                        Deactivated
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <select
                      aria-label={`Role for ${account.name}`}
                      className="input-field py-1 text-xs"
                      value={account.role}
                      // Changing your own role is refused by the API; an owner
                      // could otherwise lock themselves out of this page.
                      disabled={isMe || busy || !account.active}
                      onChange={(event) => void changeRole(account, event.target.value as AdminRole)}
                    >
                      {ADMIN_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {humanize(role)}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td className="text-muted">
                    {account.lastLoginAt ? formatRelative(account.lastLoginAt) : 'Never'}
                  </Td>
                  <Td className="text-muted">{formatDate(account.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setPasswordFor(account);
                          setNewPassword('');
                        }}
                      >
                        Set password
                      </Button>
                      {account.active ? (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isMe || busy}
                          title={isMe ? 'You cannot deactivate yourself.' : undefined}
                          onClick={() => setDeactivating(account)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={busy}
                          onClick={() => void setActive(account, true)}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={deactivating !== null}
        tone="danger"
        title={deactivating ? `Deactivate ${deactivating.name}?` : ''}
        description="They lose access on their next request, and cannot sign in again. Their past support replies stay attributed to them."
        confirmLabel="Deactivate"
        busy={busyId !== null}
        onConfirm={() => deactivating && void setActive(deactivating, false)}
        onCancel={() => setDeactivating(null)}
      />

      <ConfirmDialog
        open={passwordFor !== null}
        title={passwordFor ? `Set a password for ${passwordFor.name}` : ''}
        description={
          <div className="mt-2">
            <PasswordInput
              label={`New password (at least ${MIN_ADMIN_PASSWORD_LENGTH} characters)`}
              name="reset-admin-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="mt-2 text-xs text-muted">
              This does not end their current session. To stop someone now, deactivate them.
            </p>
          </div>
        }
        confirmLabel="Set password"
        busy={busyId !== null}
        confirmDisabled={newPassword.length < MIN_ADMIN_PASSWORD_LENGTH}
        onConfirm={() => void savePassword()}
        onCancel={() => {
          setPasswordFor(null);
          setNewPassword('');
        }}
      />
    </>
  );
}
