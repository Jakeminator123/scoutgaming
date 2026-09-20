// Browser-safe conversion: preserve typed values from the schema's descriptor.
export function parseTriggerValue(raw, descriptor, operator) {
  const scalar = text => {
    const known = descriptor.values?.find(value => String(value) === text);
    if (known !== undefined) return known;
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    if (descriptor.kind === 'number') return Number(text);
    return text;
  };
  return operator === 'in' ? raw.split(',').map(value => scalar(value.trim())) : scalar(raw);
}
