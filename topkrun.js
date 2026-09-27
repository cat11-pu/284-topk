// topkrun.js：按处理预算处理事件，用尽预算的事件连类型带名字压账；收尾不限预算清账。
import { bump, decay } from "./counters.js";

function cloneState(state) {
  state = state || {};
  return {
    counts: Object.assign({}, state.counts),
    ledger: Array.isArray(state.ledger) ? state.ledger.slice() : [],
    applied: Array.isArray(state.applied) ? state.applied.slice() : []
  };
}

function errorCode(spec, key, fallback) {
  return (spec && spec[key]) || fallback;
}

function validate(ev, spec) {
  if (!ev || typeof ev !== "object" || (ev.kind !== "hit" && ev.kind !== "decay")) {
    const err = new Error("事件不合法");
    err.code = errorCode(spec, "event_error_code", "E_BAD_EVENT");
    throw err;
  }
  if (ev.kind === "hit" && (typeof ev.name !== "string" || ev.name.length === 0)) {
    const err = new Error("命中的名字为空");
    err.code = errorCode(spec, "name_error_code", "E_BAD_NAME");
    throw err;
  }
}

function applyEvent(ev, counts) {
  return ev.kind === "hit" ? bump(counts, ev.name) : decay(counts);
}

function ledgerView(ledger) {
  return ledger.map(function (ev) {
    return [ev.kind, ev.kind === "hit" ? ev.name : ""];
  });
}

function hasId(ev) {
  return ev.id !== null && ev.id !== undefined;
}

export function topkOf(counts, k) {
  return Object.keys(counts).sort(function (a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return a < b ? -1 : a > b ? 1 : 0;
  }).slice(0, k).map(function (name) {
    return [name, counts[name]];
  });
}

export function step(spec) {
  spec = spec || {};
  const next = cloneState(spec.state);
  const appliedNow = new Set(next.applied);
  const events = Array.isArray(spec.events) ? spec.events : [];
  let remaining = Number.isFinite(spec.budget) ? Number(spec.budget) : 0;
  if (remaining < 0) remaining = 0;
  let observed = 0;

  events.forEach(function (ev) {
    validate(ev, spec);
    if (hasId(ev) && appliedNow.has(ev.id)) return;
    if (remaining <= 0) {
      next.ledger.push(ev);
      return;
    }
    next.counts = applyEvent(ev, next.counts);
    if (hasId(ev)) {
      appliedNow.add(ev.id);
      next.applied.push(ev.id);
    }
    observed += 1;
    remaining -= 1;
  });

  return {
    state: next,
    observed: observed,
    ledger_before: next.ledger.length,
    ledger: ledgerView(next.ledger),
    judged: observed,
    judged_bound: events.length
  };
}

export function close(spec) {
  spec = spec || {};
  const next = cloneState(spec.state);
  const appliedNow = new Set(next.applied);
  const pending = next.ledger;
  next.ledger = [];
  let catchup = 0;

  pending.forEach(function (ev) {
    next.counts = applyEvent(ev, next.counts);
    if (hasId(ev) && !appliedNow.has(ev.id)) {
      appliedNow.add(ev.id);
      next.applied.push(ev.id);
    }
    catchup += 1;
  });

  return { state: next, catchup: catchup, topk: topkOf(next.counts, spec.k) };
}
