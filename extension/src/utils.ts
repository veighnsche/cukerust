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
