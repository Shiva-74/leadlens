export function formatInrShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${Number(cr.toFixed(2))} Cr`;
  }
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${Number(lakhs.toFixed(1))} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatBudgetRange(
  minInr: number | null | undefined,
  maxInr: number | null | undefined,
  fallbackText?: string | null
): string {
  if (minInr && maxInr && minInr !== maxInr) {
    return `${formatInrShort(minInr)} – ${formatInrShort(maxInr)}`;
  }
  if (maxInr) {
    return `Up to ${formatInrShort(maxInr)}`;
  }
  if (minInr) {
    return `From ${formatInrShort(minInr)}`;
  }
  return fallbackText || 'Not specified';
}

export function formatIntentLabel(label?: string): string {
  switch (label) {
    case 'ready_to_buy':
      return 'Ready to buy';
    case 'serious_researching':
      return 'Serious researching';
    case 'early_browsing':
      return 'Early browsing';
    case 'investor':
      return 'Investor';
    default:
      return 'Unclear intent';
  }
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case 'new':
      return 'New';
    case 'contacted':
      return 'Contacted';
    case 'follow_up':
      return 'Follow-up';
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    default:
      return status;
  }
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (date.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays > 1 && diffDays <= 14) return `In ${diffDays} days`;

  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}