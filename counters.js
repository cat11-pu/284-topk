// counters.js：计数增减与衰减（纯函数，返回新表，不改入参）
export function bump(counts, name) {
  const next = Object.assign({}, counts);
  next[name] = (next[name] || 0) + 1;
  return next;
}

export function decay(counts) {
  const next = {};
  Object.keys(counts || {}).forEach(function (name) {
    const value = counts[name] - 1;
    if (value > 0) next[name] = value;
  });
  return next;
}
