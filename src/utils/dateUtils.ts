/**
 * Date standardization utility for Little Buds Child Care Centre.
 * Enforces DD/MM/YYYY formatting consistently across all displays, previews, and PDFs.
 */

/**
 * Formats a date string (YYYY-MM-DD or ISO) or Date object into DD/MM/YYYY.
 * Prevents timezone offset shifts by splitting YYYY-MM-DD directly when possible.
 */
export function formatDate(input?: string | Date | null): string {
  if (!input) return '—';

  try {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return '—';

      // If already in DD/MM/YYYY format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        return trimmed;
      }

      // If YYYY-MM-DD (standard HTML date input)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-');
        return `${day}/${month}/${year}`;
      }

      // If ISO timestamp (e.g. 2026-10-30T07:15:28.000Z)
      if (trimmed.includes('T')) {
        const datePart = trimmed.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [year, month, day] = datePart.split('-');
          return `${day}/${month}/${year}`;
        }
      }

      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } else if (input instanceof Date && !isNaN(input.getTime())) {
      const day = String(input.getDate()).padStart(2, '0');
      const month = String(input.getMonth() + 1).padStart(2, '0');
      const year = input.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (err) {
    console.warn('Error formatting date:', input, err);
  }

  return String(input);
}

/**
 * Returns today's date in YYYY-MM-DD format (for HTML date inputs).
 */
export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a DD/MM/YYYY string to YYYY-MM-DD for HTML input[type="date"].
 */
export function toInputDate(val?: string | null): string {
  if (!val) return getTodayIso();
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  return getTodayIso();
}
