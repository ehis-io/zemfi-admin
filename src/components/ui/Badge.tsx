import React from 'react';
import { humanize } from '../../lib/format';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-raised text-muted border-surface-border',
  info: 'bg-primary/10 text-primary-soft border-primary/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
};

/**
 * One place that decides what colour a backend status word gets, so a KYC
 * REJECTED and a withdrawal FAILED read the same way everywhere.
 */
export const toneForStatus = (status: string): BadgeTone => {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'COMPLETED':
    case 'SUCCESS':
    case 'SUCCESSFUL':
    case 'RESOLVED':
      return 'success';
    case 'PENDING':
    case 'PROCESSING':
    case 'REVIEW':
    case 'AWAITING_USER':
      return 'warning';
    case 'REJECTED':
    case 'FAILED':
    case 'INACTIVE':
      return 'danger';
    case 'OPEN':
      return 'info';
    default:
      return 'neutral';
  }
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A badge for a raw backend status string: colour + humanised label. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={toneForStatus(status)} className={className}>
      {humanize(status)}
    </Badge>
  );
}
