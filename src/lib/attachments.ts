// Files on tasks (a photo of the worksheet, a PDF). Stored in IndexedDB on this device only:
// the task keeps a small list of names so other devices can say "on another device".

/** Largest file kept (after shrinking photos). */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
/** Longest side for photos; phone pictures are shrunk to this. */
export const MAX_IMAGE_SIDE = 2000;

export const ACCEPT = 'image/*,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Scale (w, h) to fit inside max × max, keeping the aspect ratio. Never scales up. */
export function fitWithin(w: number, h: number, max = MAX_IMAGE_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Photos worth re-encoding: big raster images (GIFs keep their animation, SVGs stay vector). */
export function shouldShrink(type: string, size: number): boolean {
  return /^image\/(jpeg|png|webp|heic|heif)$/.test(type) && size > 600 * 1024;
}

export function iconFor(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📕';
  if (type.startsWith('text/')) return '📄';
  if (/sheet|excel/.test(type)) return '📊';
  if (/presentation|powerpoint/.test(type)) return '📽️';
  return '📎';
}

/** Shrink a large photo to a JPEG within MAX_IMAGE_SIDE. Returns the original when it can't (or when that's smaller). */
export async function prepareFile(file: File): Promise<{ blob: Blob; type: string; name: string }> {
  if (!shouldShrink(file.type, file.size) || typeof createImageBitmap === 'undefined') return { blob: file, type: file.type, name: file.name };
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = fitWithin(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return { blob: file, type: file.type, name: file.name };
    return { blob, type: 'image/jpeg', name: file.name.replace(/\.(png|webp|heic|heif|jpe?g)$/i, '') + '.jpg' };
  } catch {
    return { blob: file, type: file.type, name: file.name };
  }
}
