import type { ApplyPresetResult } from '../shared/types';

/**
 * Turn an apply-preset result into a single human-readable warning line, or
 * null when everything succeeded. Names the zones that failed (by target) so the
 * user knows *what* didn't position, not just how many.
 */
export function formatApplyResult(result: ApplyPresetResult | undefined | null): string | null {
  if (!result) return null;
  const parts: string[] = [];

  if (result.failedZones.length > 0) {
    const names = result.failedZones.map((z) => z.target || 'a zone');
    const shown = names.slice(0, 3);
    const extra = names.length - shown.length;
    const list = shown.join(', ') + (extra > 0 ? ` +${extra} more` : '');
    parts.push(`${result.failedZones.length} zone(s) failed to launch: ${list}`);
  }

  const closeFailed = result.closeReport?.appWindowsFailed.length ?? 0;
  if (closeFailed > 0) parts.push(`${closeFailed} window(s) could not be closed`);

  return parts.length ? parts.join('. ') + '.' : null;
}
