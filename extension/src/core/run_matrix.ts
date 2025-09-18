export function extractRunBlocks(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /```run\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const body = m[1];
    const lines = body.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const line of lines) {
      const mm = /^(suite|feature:[^\s]+|scenario:.+?):\s*(.+)$/.exec(line);
      if (mm) {
        map[mm[1]] = mm[2];
      }
    }
  }
  return map;
}
