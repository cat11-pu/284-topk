// topkrun.js：按处理预算处理并留账（纯函数，返回新状态，不改入参）
import { bump, decay } from "./counters.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalize(event, nameCode, eventCode) {
  if (!event || typeof event !== "object" || (event.kind !== "hit" && event.kind !== "decay")) {
    fail(eventCode, "bad event");
  }
  if (event.kind === "hit" && (typeof event.name !== "string" || event.name === "")) {
    fail(nameCode, "bad name");
  }
  return event.kind === "hit" ? ["hit", event.name] : ["decay", ""];
}

function applyPair(counts, pair, nameCode, eventCode) {
  if (!Array.isArray(pair) || (pair[0] !== "hit" && pair[0] !== "decay")) {
    fail(eventCode, "bad event");
  }
  if (pair[0] === "hit") {
    if (typeof pair[1] !== "string" || pair[1] === "") fail(nameCode, "bad name");
    return bump(counts, pair[1]);
  }
  return decay(counts);
}

export function step(spec) {
  const state = spec.state || {};
  const nameCode = spec.name_error_code || "E_BAD_NAME";
  const eventCode = spec.event_error_code || "E_BAD_EVENT";
  const events = spec.events || [];
  const pending = (state.ledger || []).slice();
  const applied = (state.applied || []).slice();
  const seen = new Set(applied);
  let counts = Object.assign({}, state.counts);
  let remaining = Math.max(0, spec.budget || 0);
  let observed = 0;

  while (pending.length > 0 && remaining > 0) {
    counts = applyPair(counts, pending.shift(), nameCode, eventCode);
    remaining -= 1;
    observed += 1;
  }

  events.forEach(function (event) {
    if (event && typeof event === "object" && event.id !== undefined && seen.has(event.id)) return;
    const pair = normalize(event, nameCode, eventCode);
    if (event && typeof event === "object" && event.id !== undefined) {
      seen.add(event.id);
      applied.push(event.id);
    }
    if (remaining > 0) {
      counts = applyPair(counts, pair, nameCode, eventCode);
      remaining -= 1;
      observed += 1;
    } else {
      pending.push(pair);
    }
  });

  return { state: { counts: counts, ledger: pending, applied: applied },
           observed: observed,
           ledger_before: pending.length,
           ledger: pending,
           judged: observed,
           judged_bound: events.length + (state.ledger || []).length };
}

export function close(spec) {
  const state = spec.state || {};
  const nameCode = spec.name_error_code || "E_BAD_NAME";
  const eventCode = spec.event_error_code || "E_BAD_EVENT";
  const pending = (state.ledger || []).slice();
  let counts = Object.assign({}, state.counts);
  let catchup = 0;

  while (pending.length > 0) {
    counts = applyPair(counts, pending.shift(), nameCode, eventCode);
    catchup += 1;
  }

  return { state: { counts: counts, ledger: [], applied: (state.applied || []).slice() },
           catchup: catchup };
}
