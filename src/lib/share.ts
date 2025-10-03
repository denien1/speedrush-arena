export async function smartShare(opts: { url?: string; text?: string; title?: string }) {
  const url = opts.url ?? (typeof window !== 'undefined' ? window.location.href : '');
  const title = opts.title ?? 'SpeedRush Arena';
  const text = opts.text ?? 'Come play SpeedRush Arena!';
  try {
    // Prefer native share sheet on mobile/modern browsers
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return { ok: true, method: 'navigator.share' };
    }
    // Fallback to clipboard (requires https or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return { ok: true, method: 'clipboard' };
    }
    // Last-resort fallback
    const ok = window.prompt('Copy this link:', url);
    return { ok: !!ok, method: 'prompt' };
  } catch (e) {
    return { ok: false, error: e };
  }
}
