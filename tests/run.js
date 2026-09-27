import assert from "node:assert";
import { bump, decay } from "../counters.js";
import { step, close } from "../topkrun.js";
import { render } from "../app.js";

const base = {
  budget: 3, k: 2,
  state: { counts: {}, ledger: [], applied: [] },
  events: [],
  name_error_code: "E_BAD_NAME", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("bump returns a table", () => {
  assert.strictEqual(typeof bump({}, "x"), "object");
});

check("decay returns a table", () => {
  assert.strictEqual(typeof decay({}), "object");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
