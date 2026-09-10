const dateTime = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const parse = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value: string | null | undefined): string => {
  const date = parse(value);
  return date ? dateTime.format(date) : '—';
};

export const formatDate = (value: string | null | undefined): string => {
  const date = parse(value);
  return date ? dateOnly.format(date) : '—';
};

/** "3m ago", "2h ago", "5d ago" — falls back to the date past a week. */
export const formatRelative = (value: string | null | undefined): string => {
  const date = parse(value);
  if (!date) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return dateOnly.format(date);
};

/**
 * Amounts arrive as strings (withdrawals) or numbers (balances). The currency
 * is whatever the record carries -- never assumed -- and unknown ISO codes
 * (crypto tickers, say) fall back to a plain number with the code appended.
 */
export const formatAmount = (amount: string | number, currency: string): string => {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value)} ${currency}`;
  }
};

export const fullName = (person: { firstName: string; lastName: string }): string =>
  `${person.firstName} ${person.lastName}`.trim() || '—';

/** "AWAITING_USER" -> "Awaiting user". */
export const humanize = (value: string): string => {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export const shortId = (id: string): string => (id.length > 8 ? `${id.slice(0, 8)}…` : id);
