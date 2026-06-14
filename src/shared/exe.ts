/**
 * Normalize any exe reference a user might provide — a full path, a name with or
 * without an extension, any casing, stray whitespace — into the single canonical
 * match key MonCOM uses internally: the base name, launcher extension stripped,
 * trimmed, lowercased.
 *
 *   "C:\\Apps\\DSS Client.exe" → "dss client"
 *   "DSSClient.EXE"            → "dssclient"
 *   "  Spotify "               → "spotify"
 *
 * Used on both sides of every exe comparison (and when saving a profile) so
 * matching never depends on the user typing it perfectly.
 */
export function normalizeExe(input: string): string {
  if (!input) return '';
  const base = input.replace(/\\/g, '/').split('/').pop() ?? input;
  return base.replace(/\.(exe|lnk|bat|cmd|com|scr)$/i, '').trim().toLowerCase();
}
