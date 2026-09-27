import fs from "node:fs";
import { bump, decay } from "./counters.js";
import { step, close } from "./topkrun.js";

// 验收断言：上面每条值收进 emit，最后与期望值逐项比对，不符就非零退出。
const __lines = [];
function emit(label, value) { __lines.push([String(label).replace(/ =$/, ""), value]); }


const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/hits.json", "utf8"));
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

emit("收尾后计数表 =", JSON.stringify(Object.keys(closed.state.counts).sort().map(function (name) {
  return [name, closed.state.counts[name]];
})));
emit("收尾后前若干名 =", JSON.stringify(names.slice(0, spec.k).map(function (name) {
  return [name, closed.state.counts[name]];
})));
emit("首轮处理条数 =", first.observed);
emit("二档处理条数 =", wide.observed);
emit("两个预算档处理不同 =", first.observed !== wide.observed);
emit("收尾前待处理账 =", first.ledger_before);
emit("压在账上的事件 =", JSON.stringify(first.ledger));
emit("收尾补齐条数 =", closed.catchup);
emit("收尾后待处理账 =", closed.state.ledger.length);
emit("拆两轮中间态不同 =", fingerprint(r2.state) !== fingerprint(first.state));
emit("拆两轮收尾态一致 =", fingerprint(closedTwo.state) === fingerprint(closed.state));
emit("重放新处理 =", replay.observed);
emit("工作计数未超上界 =", first.judged <= first.judged_bound);
emit("与全量对照差异 =", fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1);


// ---- 异常路径探针：真调用实现，看它报出什么码（不是从样例里抄）----
let emptyNameCode = "没有报错";
try {
  step(Object.assign({}, { budget: 3, k: 2,
    state: { counts: {}, ledger: [], applied: [] },
    events: [{ id: 1, kind: "hit", name: "" }] }));
} catch (error) {
  emptyNameCode = error && error.code ? error.code : String(error.message);
}
emit("空名字报码", emptyNameCode);
let badEventCode = "没有报错";
try {
  step(Object.assign({}, { budget: 3, k: 2,
    state: { counts: {}, ledger: [], applied: [] },
    events: [{ id: 1, kind: "peek", name: "a" }] }));
} catch (error) {
  badEventCode = error && error.code ? error.code : String(error.message);
}
emit("事件不合法报码", badEventCode);


// ---- 七条机检断言：真算真比，任何一条不过都按失败计数 ----
const machineChecks = [
  ["两档处理条数不同", first.observed !== wide.observed],
  ["收尾前账大于零而收尾后归零", first.ledger_before > 0 && closed.state.ledger.length === 0],
  ["拆两轮中间态不同而收尾态一致",
    fingerprint(r2.state) !== fingerprint(first.state)
      && fingerprint(closedTwo.state) === fingerprint(closed.state)],
  ["重放不再处理", replay.observed === 0],
  ["工作计数不超事件条数", first.judged <= first.judged_bound && first.judged_bound === events.length],
  ["与全量对照为零", (fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1) === 0],
  ["异常探针真调", emptyNameCode === "E_BAD_NAME" && badEventCode === "E_BAD_EVENT"]
];
let machineBad = 0;
for (const [label, passed] of machineChecks) {
  if (passed) { console.log("机检通过 " + label); }
  else { machineBad += 1; console.log("机检失败 " + label); }
}
console.log("机检断言 " + (machineChecks.length - machineBad) + "/" + machineChecks.length + " 通过");


// ---- 期望值（参考模型算出，与题面给的验收数值一致）----
const EXPECTED = {
  "收尾后计数表": [
    [
      "a",
      2
    ],
    [
      "b",
      2
    ]
  ],
  "收尾后前若干名": [
    [
      "a",
      2
    ],
    [
      "b",
      2
    ]
  ],
  "首轮处理条数": 3,
  "二档处理条数": 5,
  "两个预算档处理不同": true,
  "收尾前待处理账": 5,
  "压在账上的事件": [
    [
      "hit",
      "b"
    ],
    [
      "hit",
      "a"
    ],
    [
      "hit",
      "c"
    ],
    [
      "decay",
      ""
    ],
    [
      "hit",
      "a"
    ]
  ],
  "收尾补齐条数": 5,
  "收尾后待处理账": 0,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "重放新处理": 0,
  "工作计数未超上界": true,
  "与全量对照差异": 0,
  "空名字报码": "E_BAD_NAME",
  "事件不合法报码": "E_BAD_EVENT"
};
// 有的值在收进来之前已经 stringify 过，比较前先试着解析回来，避免类型错配把正确实现判成不过。
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { /* 不是 JSON 就按原文比 */ }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  const got = found[1];
  if (__same(got, want)) { console.log("一致 " + label + " = " + JSON.stringify(got)); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(got)); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 && machineBad === 0 ? 0 : 1);
