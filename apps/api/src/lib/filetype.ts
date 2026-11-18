/**
 * Identifies uploaded documents by their first bytes ("magic numbers") instead of trusting the
 * browser-supplied MIME type or file extension, which an uploader controls.
 */
export type DocumentType = { mime: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'pdf' | 'png' | 'jpg' | 'webp' };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniffDocumentType(buf: Buffer): DocumentType | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG)) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}
