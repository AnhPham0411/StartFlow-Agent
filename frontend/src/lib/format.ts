export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 0 }).format(
    value,
  );
}
