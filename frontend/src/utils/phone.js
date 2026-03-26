// Basic phone normalization helper for the frontend.
// Purpose: convert common local formats to E.164 where possible before sending to backend.
// This is intentionally conservative and mirrors backend behavior for India (+91) primarily.

export function normalizePhone(input) {
  if (!input) return input;
  const s = String(input).trim();
  if (s.startsWith('+')) return s;
  // Strip non-digit characters
  const digits = s.replace(/[^0-9]/g, '');
  // Common cases:
  // 10 digits -> assume India +91
  if (digits.length === 10) return `+91${digits}`;
  // 11 digits starting with 0 -> drop leading 0 and prefix +91
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  // If already includes country code without plus (e.g., 919...) -> add plus
  if (digits.length > 10) return `+${digits}`;
  // Fallback: return trimmed input
  return s;
}

export default normalizePhone;
