export function toSnippet(regex: string): string {
  // Basic conversion: (\d+) -> ${1:number}; (.+) -> ${1:value}
  let idx = 1;
  return regex
    .replace(/^\^|\$$/g, '')
    // Replace grouped numeric captures first to drop parentheses
    .replace(/\(\\d\+\)/g, () => `${'${'}${idx++}:number}`)
    .replace(/\(\.\+\)/g, () => `${'${'}${idx++}:value}`)
    // Fallback: bare \\d+ occurrences
    .replace(/\\d\+/g, () => `${'${'}${idx++}:number}`);
}

export function shellQuote(s: string): string {
  // Cross-shell best-effort quoting
  if (process.platform === 'win32') {
    const q = s.replace(/"/g, '""');
    return `"${q}"`;
  }
  // POSIX-like quoting
  if (s === '') return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s; // safe
  // End quote, insert '"'"'', reopen quote
  return `'${s.replace(/'/g, `"'"'`)}'`;
}
