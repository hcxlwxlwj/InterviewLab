/** Bounded incremental JSON decoder. Completed fields use JSON.parse; partial strings never use regex extraction. */
export function jsonFields(text: string): {
  fields: Record<string, unknown>;
  partial?: { key: string; value: string };
} {
  if (text.length > 65536) throw new Error('Model stream too large');
  const fields: Record<string, unknown> = {};
  let depth = 0,
    inString = false,
    escape = false,
    start = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
      if (depth === 1) start = i + 1;
    } else if (c === '}' || c === ']') {
      if (depth === 1 && start >= 0 && text.slice(start, i).trim())
        Object.assign(fields, JSON.parse('{' + text.slice(start, i) + '}'));
      depth--;
    } else if (c === ',' && depth === 1) {
      Object.assign(fields, JSON.parse('{' + text.slice(start, i) + '}'));
      start = i + 1;
    }
  }
  if (depth === 1 && start >= 0) {
    const tail = text.slice(start);
    let at = 0;
    while (/\s/.test(tail[at] ?? '') && at < tail.length) at++;
    if (tail[at] !== '"') return { fields };
    let end = at + 1;
    for (; end < tail.length; end++) {
      if (tail[end] === '\\') {
        end++;
        continue;
      }
      if (tail[end] === '"') break;
    }
    if (end >= tail.length) return { fields };
    const key = JSON.parse(tail.slice(at, end + 1));
    at = end + 1;
    while (at < tail.length && /\s/.test(tail[at])) at++;
    if (tail[at++] !== ':') return { fields };
    while (at < tail.length && /\s/.test(tail[at])) at++;
    if (tail[at++] !== '"') return { fields };
    let value = '';
    for (; at < tail.length; at++) {
      const c = tail[at];
      if (c === '"') return { fields: { ...fields, [key]: value } };
      if (c !== '\\') {
        if (c < ' ') throw new Error('Invalid JSON string');
        value += c;
        continue;
      }
      if (++at >= tail.length) break;
      const e = tail[at];
      if (e === 'u') {
        const hex = tail.slice(at + 1, at + 5);
        if (hex.length < 4) break;
        if (!/^[\da-f]{4}$/i.test(hex)) throw new Error('Invalid escape');
        value += String.fromCharCode(parseInt(hex, 16));
        at += 4;
      } else {
        const map: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        if (!(e in map)) throw new Error('Invalid escape');
        value += map[e];
      }
    }
    return { fields, partial: { key, value } };
  }
  return { fields };
}
export async function readChatStream(
  response: Response,
  onContent: (text: string) => Promise<void>,
  signal: AbortSignal,
  onUsage?: (usage: Record<string, number>) => void,
) {
  if (!response.body) throw new Error('Missing stream');
  let pending = '',
    all = '',
    finished = false;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  try {
    while (true) {
      if (signal.aborted) throw new Error('Cancelled');
      const part = await reader.read();
      if (part.done) break;
      pending += decoder.decode(part.value, { stream: true });
      if (pending.length > 262144) throw new Error('Oversized stream frame');
      let at: number;
      while ((at = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, at).trim();
        pending = pending.slice(at + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          finished = true;
          continue;
        }
        const row = JSON.parse(data);
        if (row.error) throw new Error('Provider stream error');
        if (row.usage) {
          const usage: Record<string, number> = {};
          for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens'])
            if (Number.isFinite(row.usage[key])) usage[key] = row.usage[key];
          if (Object.keys(usage).length) onUsage?.(usage);
        }
        const choice = row.choices?.[0];
        if (choice?.finish_reason && choice.finish_reason !== 'stop')
          throw new Error('Incomplete model output');
        const delta = choice?.delta?.content;
        if (typeof delta === 'string') {
          all += delta;
          if (all.length > 65536) throw new Error('Oversized model output');
          await onContent(all);
        }
      }
    }
    if (!finished) throw new Error('Truncated stream');
    return all;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
