/**
 * Contact-detail masking for free text (messages, request notes, bios).
 * Keeps all communication in-platform, which is what protects mentors from being over-contacted.
 */
const PATTERNS: RegExp[] = [
  // plain email addresses (run first so obfuscation rules never split a real address)
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  // obfuscated emails with bracketed separators: "name [at] domain [dot] com"
  /[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\{at\})\s*[A-Z0-9-]+(?:\s*(?:\.|\[dot\]|\(dot\)|\s+dot\s+)\s*[A-Z0-9-]+)*?\s*(?:\.|\[dot\]|\(dot\)|\s+dot\s+)\s*[A-Z]{2,}\b/gi,
  // "name at gmail.com" / "name at gmail dot com" — only for mail providers, so "practice at leetcode.com" is untouched
  /[A-Z0-9._%+-]+\s+at\s+(?:gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|me|proton|protonmail|rediffmail|aol|zoho|gmx)\s*(?:\.|\[dot\]|\(dot\)|\s+dot\s+)\s*[A-Z]{2,}(?:\s*(?:\.|\[dot\]|\s+dot\s+)\s*[A-Z]{2,})?\b/gi,
  // phone numbers: 10+ digits allowing spaces, dashes, dots, parentheses and a leading +
  /(?<![\w])\(?(?:\+?\d[\s().-]{0,2}){9,}\d(?![\w])/g,
  // social / direct-contact links
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|wa\.me|api\.whatsapp\.com|t\.me|telegram\.me|instagram\.com|facebook\.com|fb\.com|twitter\.com|x\.com)\/[^\s]*/gi,
];

export const MASK = '[contact hidden]';

export function maskContactDetails(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const re of PATTERNS) {
    out = out.replace(re, (m) => {
      // Dates/times like "2026-05-12 10:30" are not phone numbers.
      if (/\d{4}-\d{2}-\d{2}/.test(m) || /\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(m)) return m;
      count++;
      return MASK;
    });
  }
  return { text: out, count };
}
