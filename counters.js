// counters.js：计数增减与衰减（不改动入参，一律返回新表）
export function bump(counts, name) {
  const next = Object.assign({}, counts);
  next[name] = (Object.prototype.hasOwnProperty.call(next, name) ? next[name] : 0) + 1;
  return next;
}

export function decay(counts) {
  const next = {};
  for (const name of Object.keys(counts)) {
    const remaining = counts[name] - 1;
    if (remaining > 0) next[name] = remaining;
  }
  return next;
}
