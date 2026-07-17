const sensitiveKey =
  /authorization|cookie|password|secret|token|api[-_]?key|raw[-_]?prompt|chain[-_]?of[-_]?thought|reasoning/i;
const maxDepth = 8;

function redactString(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/((?:password|secret|token|api[-_]?key)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

export function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > maxDepth) {
    return '[REDACTED_DEPTH_LIMIT]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, depth + 1));
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redactUnknown(nested, depth + 1),
      ]),
    );
  }
  return value;
}

export function redactPublicPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return redactUnknown(payload) as Record<string, unknown>;
}
