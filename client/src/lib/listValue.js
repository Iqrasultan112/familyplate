export function listValue(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  const text = value.trim();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
    } catch { /* Accept older comma-separated profile values below. */ }
  }
  return text.split(/[\n,;]/).map(item => item.trim()).filter(Boolean);
}
