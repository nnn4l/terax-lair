export function resolveLairWorkspace(
  selected: string,
  candidate: string | null,
): string {
  const trimmed = selected.trim();
  if (trimmed) return trimmed;
  return candidate?.trim() ?? "";
}
