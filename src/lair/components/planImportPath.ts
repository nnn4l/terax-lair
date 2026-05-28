export function resolvePlanImportPath(path: string, workspace: string): string {
  const normalized = path.trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^([A-Za-z]:|\/)/.test(normalized)) return normalized;
  const root = workspace.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return root ? `${root}/${normalized.replace(/^\/+/, "")}` : normalized;
}
