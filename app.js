// app.js：渲染结果
import { bump, decay } from "./counters.js";
import { step, close } from "./topkrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { events: events, budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      counts: state.counts, ledger: state.ledger, applied: state.applied.length
    });
  };
  const names = Object.keys(closed.state.counts).sort(function (a, b) {
    if (closed.state.counts[b] !== closed.state.counts[a]) return closed.state.counts[b] - closed.state.counts[a];
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return { counts: Object.keys(closed.state.counts).sort().map(function (name) {
             return [name, closed.state.counts[name]];
           }),
           topk: names.slice(0, spec.k).map(function (name) {
             return [name, closed.state.counts[name]];
           }),
           observed_first: first.observed, observed_wide: wide.observed,
           pair_differs: first.observed !== wide.observed,
           ledger_before: first.ledger_before, ledger: first.ledger,
           catchup: closed.catchup, ledger_after: closed.state.ledger.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.observed, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length,
           tail: Object.keys(bump({}, "x")).length + Object.keys(decay({})).length };
}
