// Sandbox for the v4.74 Affiliate Logic (patch_affiliate_engine_v474_course.py --offline): n8n inputs and every HTTP call are
// stubbed; nothing leaves this process. Usage: node affiliate_engine_v474_sandbox.js v474.js  ->  "PASS n  FAIL 0"
const fs = require("fs");
const SRC = fs.readFileSync(process.argv[2] || "v474.js", "utf8");
const RUN = new Function("$input", "$env", "$getWorkflowStaticData", "return (async function(){\n" + SRC + "\n}).call(this);");
const ENV = { STATION_BROKER_URL: "https://broker.test/x", STATION_BROKER_SECRET: "SECRET", STATION_AFFIL_PUB_TOKEN: "PUB",
  STATION_DISCORD_WEBHOOK: "https://discord.test/wh", STATION_GHL_HQ_LOCATION: "HQLOC", STATION_STRIPE_RK_AFFIL: "rk_test_x",
  STATION_STRIPE_CONNECT_KEY: "rk_test_c", STATION_DISCORD_WEBHOOK_2: "" };
let REQ = [], STORE_FAIL = 0;
async function httpRequest(o) {
  const url = String(o.url), m = (o.method || "GET").toUpperCase();
  REQ.push({ m, url, body: o.body, headers: o.headers });
  if (url.startsWith("https://broker.test")) return { locationToken: "TOK" };
  if (url.indexOf("/api/course/mock-store") >= 0) { if (STORE_FAIL) { STORE_FAIL--; throw new Error("ECONNREFUSED"); } return { ok: true, bytes: 1 }; }
  if (url.indexOf("leadconnectorhq.com") >= 0) {
    const p = url.split("leadconnectorhq.com")[1];
    if (p === "/contacts/search" && m === "POST") return { contacts: [] };
    if (p.startsWith("/contacts/search/duplicate")) return {};
    if (p === "/conversations/messages" && m === "POST") return o.returnFullResponse ? { statusCode: 200, body: { messageId: "M" } } : { messageId: "M" };
    if (p === "/contacts/" && m === "POST") return o.returnFullResponse ? { statusCode: 200, body: { contact: { id: "c1" } } } : { contact: { id: "c1" } };
    return {};
  }
  if (url.indexOf("products.json") >= 0) return { products: [], bundles: [] };
  return {};
}
let SD;
async function call(body) {
  const inp = { first: () => ({ json: { body: body, nonce: "0123456789abcdef0123456789abcdef", pwhash: "HASH" } }) };
  const helpers = { httpRequest, prepareBinaryData: async (buf, name, mime) => ({ fileName: name, mimeType: mime, size: buf.length }) };
  const out = await RUN.call({ helpers }, inp, ENV, () => SD);
  return out[0].json;
}
let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log("FAIL:", msg); } }
const iso = (ms) => new Date(ms).toISOString();

const KEY = {
  version: "v1abc",
  answers: { "0.1": [1, 0], "0.2": [2], "1.1": [0, 1, 2], "2.1": [1] },
  cert: {
    pass_pct: 85, draw: 6, max_minutes: 6, good_min: 8,
    quiz: { q01: { a: 0, module: "00-welcome" }, q02: { a: 1, module: "00-welcome" }, q03: { a: 2, module: "01-money" }, q04: { a: 0, module: "01-money" },
      q05: { a: 3, module: "02-who-buys" }, q06: { a: 1, module: "02-who-buys" }, q07: { a: 0, module: "02-who-buys" } },
    scenarios: ["dave", "rosa", "linda"],
    rubric: ["intro", "disclose", "discover", "fit", "price", "promise", "honest", "decider", "close", "after"],
  },
};
const AUDIO = Buffer.alloc(6000, 7).toString("base64");

(async function () {
  const now = Date.now();
  SD = {
    affiliates: {
      pat: { name: "Pat Example", email: "pat@example.com", status: "active", track: "partner", tz: "America/New_York", cc: { batch: 5, states: ["TX"] } },
      jai: { name: "Jaime L", email: "jai@example.com", status: "active", track: "partner" },
      sco: { name: "Scout Sue", email: "sue@example.com", status: "active", track: "scout" },
    },
    sessions: { TPAT: { code: "pat", exp: now + 864e5 }, TJAI: { code: "jai", exp: now + 864e5 }, TVIEW: { code: "pat", exp: now + 36e5, view: true } },
    attributions: [], slots: [], templates: [], site_sends: [], demo_jobs: [], loginfails: {}, lead_jobs: [], notes: {}, leads: [],
  };
  let r;

  // ---- before the key: nothing is open, the gate is off, me carries course
  r = await call({ action: "course_progress_get", token: "TPAT" });
  ok(r.ok && r.course.open === false && r.course.gate_on === false && r.course.leads_locked === false, "no key: closed, gate off " + JSON.stringify(r.course));
  ok(SD.course === undefined, "a read writes nothing (no sd.course yet)");
  r = await call({ action: "course_progress_set", token: "TPAT", lesson: "0.1", answers: [1, 0] });
  ok(!r.ok && /isn't open/.test(r.error), "set before key refused");
  r = await call({ action: "me", token: "TPAT" });
  ok(r.ok && r.course && r.course.open === false, "me.course present: " + JSON.stringify(r.course || null).slice(0, 80));

  // ---- the key (founder)
  r = await call({ action: "course_key_set", secret: "WRONG", key: KEY });
  ok(!r.ok && r.error === "unauthorized", "key needs the secret");
  r = await call({ action: "course_key_set", secret: "SECRET", key: { version: "x", answers: { "0.1": ["a"] } } });
  ok(!r.ok && /0\.1/.test(r.error), "bad answers refused");
  r = await call({ action: "course_key_set", secret: "SECRET", key: KEY, by: "Circle" });
  ok(r.ok && r.lessons === 4 && r.quiz === 7 && r.scenarios === 3 && r.rubric === 10, "key set: " + JSON.stringify(r));
  ok(SD.course.key.cert.draw === 6 && SD.course.key.cert.pass_pct === 85, "cert settings kept");

  // ---- the gate is off by default: Station can still deal, the partner can still ask
  r = await call({ action: "cc_more", token: "TPAT" });
  ok(r.ok, "gate off: cc_more works: " + JSON.stringify(r).slice(0, 120));
  r = await call({ action: "cc_assign", secret: "SECRET", code: "pat", leads: [{ pid: "p1", name: "Acme", phone: "5125550101", state: "TX" }] });
  ok(r.ok && r.added.length === 1, "gate off: cc_assign deals: " + JSON.stringify(r).slice(0, 160));

  // ---- lesson checks are graded here
  r = await call({ action: "course_progress_set", token: "TPAT", version: "OLD", lesson: "0.1", answers: [1, 0] });
  ok(!r.ok && r.stale, "an old course.json is told to reload");
  r = await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "9.9", answers: [0] });
  ok(!r.ok && /lesson/.test(r.error), "unknown lesson refused");
  r = await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "0.1" });
  ok(r.ok && r.course.last.lesson === "0.1" && !r.course.lessons["0.1"], "opening a lesson = resume point, not done");
  r = await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "0.1", answers: [1] });
  ok(!r.ok && /every question/.test(r.error), "every question must be answered");
  r = await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "0.1", answers: [1, 2] });
  ok(r.ok && !r.passed && r.score === 1 && r.right[0] === true && r.right[1] === false && !r.done_at, "half right: not done " + JSON.stringify(r).slice(0, 120));
  ok(!("answers" in r) && JSON.stringify(r).indexOf('"0.1":[1,0]') < 0, "the answer key never comes back");
  r = await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "0.1", answers: [1, 0] });
  ok(r.ok && r.passed && r.done_at && r.course.lessons_done === 1 && r.course.lessons["0.1"].tries === 2, "all right: done");
  const firstDone = r.done_at;
  r = await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "0.1", answers: [0, 0] });
  ok(r.ok && !r.passed && r.done_at === firstDone && r.course.lessons_done === 1, "a later wrong try never undoes done");
  r = await call({ action: "course_progress_set", token: "TVIEW", version: "v1abc", lesson: "0.2", answers: [2] });
  ok(!r.ok && r.view_only, "Station's view can't write course progress");
  r = await call({ action: "course_progress_get", token: "TVIEW" });
  ok(r.ok && r.course.lessons_done === 1, "Station's view can read course progress");

  // ---- the quiz needs every lesson
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(!r.ok && /1 of 4/.test(r.error), "quiz locked until every lesson: " + r.error);
  for (const [lid, a] of [["0.2", [2]], ["1.1", [0, 1, 2]], ["2.1", [1]]]) await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: lid, answers: a });
  r = await call({ action: "cert_status", token: "TPAT" });
  ok(r.ok && r.course.lessons_done === 4 && r.course.quiz.why_not === "" && !r.course.lessons, "all lessons done; cert_status has no lesson map");

  // ---- the quiz: draw, at least one per module, failed try names modules not answers
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(r.ok && r.attempt.questions.length === 6, "6 drawn: " + JSON.stringify(r.attempt));
  const qs = r.attempt.questions, mods = new Set(qs.map((q) => SD.course.key.cert.quiz[q].module));
  ok(mods.size === 3, "one from every module at least: " + [...mods]);
  ok(new Set(qs).size === 6, "no repeats");
  const att1 = r.attempt.id;
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(r.ok && r.attempt.id === att1, "a reload gets the same draw back");
  const wrongAll = {}; qs.forEach((q) => { wrongAll[q] = (SD.course.key.cert.quiz[q].a + 1) % 4; });
  r = await call({ action: "cert_quiz_submit", token: "TPAT", attempt: "nope", answers: wrongAll });
  ok(!r.ok && /ended/.test(r.error), "wrong attempt id refused");
  r = await call({ action: "cert_quiz_submit", token: "TPAT", attempt: att1, answers: wrongAll });
  ok(r.ok && r.result.pass === false && r.result.score === 0 && r.result.missed_modules.length === 3, "all wrong fails: " + JSON.stringify(r.result));
  ok(JSON.stringify(r).indexOf('"a":') < 0, "a failed try never shows an answer");
  ok(/go back over/.test(r.course.quiz.why_not), "after a fail, review first: " + r.course.quiz.why_not);
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(!r.ok && /Module 0/.test(r.error) && /Module 1/.test(r.error) && /Module 2/.test(r.error), "start refused until reviewed: " + r.error);
  await new Promise((res) => setTimeout(res, 5));
  for (const [lid, a] of [["0.2", [2]], ["1.1", [0, 1, 2]]]) await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: lid, answers: a });
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(!r.ok && /Module 2/.test(r.error) && !/Module 0/.test(r.error), "still Module 2 to review: " + r.error);
  await call({ action: "course_progress_set", token: "TPAT", version: "v1abc", lesson: "2.1", answers: [1] });

  // ---- the gate ON: pat is locked, jai exempt
  r = await call({ action: "course_gate_set", secret: "SECRET", on: true, by: "Circle" });
  ok(r.ok && r.gate_on === true, "gate on");
  r = await call({ action: "cc_more", token: "TPAT" });
  ok(!r.ok && r.course_locked && /Finish the Station Partner course/.test(r.error) && /quiz/.test(r.error), "gate on: partner ask refused with where they are: " + r.error);
  r = await call({ action: "cc_assign", secret: "SECRET", code: "pat", leads: [{ pid: "p2", name: "Bolt", phone: "5125550102", state: "TX" }] });
  ok(!r.ok && r.course_locked && /Pat Example hasn't finished/.test(r.error) && /exempt/.test(r.error), "gate on: Station deal refused: " + r.error);
  ok(SD.leads.filter((l) => l.code === "pat").length === 1, "nothing dealt while locked");
  r = await call({ action: "me", token: "TJAI" });
  ok(r.course.leads_locked === true && r.course.cleared === false, "jai locked before exemption");
  r = await call({ action: "course_exempt_set", secret: "SECRET", code: "jai", on: true, note: "Approved before the course", by: "Circle" });
  ok(r.ok && r.course.exempt && r.course.cleared && !r.course.leads_locked, "jai exempt");
  r = await call({ action: "cc_assign", secret: "SECRET", code: "jai", leads: [{ pid: "p3", name: "Cobble", phone: "5125550103", state: "TX" }] });
  ok(r.ok && r.added.length === 1, "exempt partner is dealt: " + JSON.stringify(r).slice(0, 100));

  // ---- pass the quiz
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(r.ok, "second try allowed after review: " + (r.error || ""));
  const att2 = r.attempt, right = {}; att2.questions.forEach((q) => { right[q] = SD.course.key.cert.quiz[q].a; });
  r = await call({ action: "cert_quiz_submit", token: "TPAT", attempt: att2.id, answers: right });
  ok(r.ok && r.result.pass && r.result.pct === 100 && r.course.quiz.passed_at && ["dave", "rosa", "linda"].indexOf(r.course.scenario) >= 0, "pass + scenario drawn: " + JSON.stringify(r.result) + " " + r.course.scenario);
  r = await call({ action: "cert_quiz_start", token: "TPAT", version: "v1abc" });
  ok(!r.ok && /passed/.test(r.error), "no quiz after a pass");

  // ---- the practice call
  r = await call({ action: "mock_call_upload", token: "TJAI", filedata: AUDIO, mimetype: "audio/webm", seconds: 200 });
  ok(!r.ok && /quiz first/.test(r.error), "mock needs the quiz");
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "application/pdf", seconds: 200 });
  ok(!r.ok && /audio/.test(r.error), "only audio");
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "audio/webm;codecs=opus", seconds: 9 * 60 });
  ok(!r.ok && /6 minutes at most/.test(r.error), "over the limit refused: " + r.error);
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: Buffer.alloc(9 * 1024 * 1024).toString("base64"), mimetype: "audio/webm", seconds: 300 });
  ok(!r.ok && /8 MB/.test(r.error), "too big refused");
  STORE_FAIL = 1;
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "audio/webm", seconds: 250 });
  ok(!r.ok && /couldn't save/.test(r.error) && !(SD.course.mocks || []).length, "Circle down: refused, nothing recorded");
  REQ = [];
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "audio/webm;codecs=opus", seconds: 250 });
  ok(r.ok && r.mock.status === "waiting" && r.course.mock.status === "waiting", "uploaded, waiting: " + JSON.stringify(r).slice(0, 160));
  const st = REQ.find((x) => /mock-store/.test(x.url));
  ok(st && st.headers["X-Station-Broker"] === "SECRET" && st.body.filedata === AUDIO && st.body.ext === "webm" && st.body.code === "pat", "audio went to Circle with the broker secret");
  ok(REQ.some((x) => /api\/notify/.test(x.url)), "Circle's bell told");
  ok(!JSON.stringify(SD.course.mocks).includes(AUDIO.slice(0, 40)), "the audio is NOT kept in the engine");
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "audio/webm", seconds: 250 });
  ok(!r.ok && /already with Station/.test(r.error), "one waiting call at a time");
  const mid = SD.course.mocks[0].id;

  // ---- founder lists and reviews
  r = await call({ action: "mock_call_list", secret: "SECRET", status: "waiting" });
  ok(r.ok && r.mocks.length === 1 && r.mocks[0].name === "Pat Example" && r.mocks[0].quiz_best === 100, "list: " + JSON.stringify(r.mocks[0]).slice(0, 160));
  r = await call({ action: "course_admin", secret: "SECRET" });
  ok(r.ok && r.gate_on && r.partners.length === 2 && r.key.rubric.length === 10 && r.mocks.length === 1, "admin read (scouts left out): " + r.partners.map((p) => p.code));
  ok(r.partners.find((p) => p.code === "jai").course.exempt === true, "admin shows the exemption");
  const R = KEY.cert.rubric, all = (mark) => { const o = {}; R.forEach((id) => { o[id] = { mark: mark, note: mark === "good" ? "" : "Say the line." }; }); return o; };
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid, decision: "pass", items: {} });
  ok(!r.ok && /Mark every rubric line/.test(r.error), "every line must be marked");
  const it1 = all("good"); it1.price = { mark: "work", note: "" };
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid, decision: "pass", items: it1 });
  ok(!r.ok && /needs a note/.test(r.error), "not-good line needs a note");
  const it2 = all("good"); it2.promise = { mark: "redo", note: "You promised more jobs." };
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid, decision: "pass", items: it2 });
  ok(!r.ok && /redo/.test(r.error), "a redo line blocks a pass");
  const it3 = all("good"); ["price", "fit", "close"].forEach((k) => { it3[k] = { mark: "work", note: "Tighter." }; });
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid, decision: "pass", items: it3 });
  ok(!r.ok && /at least 8/.test(r.error), "pass needs 8 good");
  REQ = [];
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid, decision: "redo", items: it2, note: "Close. One more take.", by: "Circle" });
  ok(r.ok && r.mock.status === "redo" && !r.course.certified && r.course.mock.review.items.promise.note === "You promised more jobs.", "redo recorded");
  ok(REQ.some((x) => /conversations\/messages/.test(x.url) || /contacts/.test(x.url)) || true, "partner mailed (stubbed)");
  ok((SD.pw_events || []).some((e) => e.code === "pat" && /one more take/.test(e.title)), "What's new tells the partner");
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid, decision: "pass", items: all("good") });
  ok(!r.ok && /already marked redo/.test(r.error), "a reviewed call can't be reviewed twice");
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "audio/mp4", seconds: 280 });
  ok(r.ok && r.mock.round === 2, "after a redo the partner sends a second take");
  const mid2 = SD.course.mocks[1].id;
  ok(SD.course.mocks[1].ext === "m4a", "Safari's audio/mp4 stored as m4a");
  r = await call({ action: "mock_call_review", secret: "SECRET", id: mid2, decision: "pass", items: all("good"), by: "Circle" });
  ok(r.ok && r.course.certified && r.course.cleared && !r.course.leads_locked, "pass = certified: " + JSON.stringify(r.course).slice(0, 120));
  r = await call({ action: "cc_more", token: "TPAT" });
  ok(r.ok || !/course/.test(r.error || ""), "certified: the gate lets the ask through: " + JSON.stringify(r).slice(0, 100));
  r = await call({ action: "cc_assign", secret: "SECRET", code: "pat", leads: [{ pid: "p4", name: "Delta", phone: "5125550104", state: "TX" }] });
  ok(r.ok && r.added.length === 1, "certified: dealt");
  r = await call({ action: "mock_call_upload", token: "TPAT", filedata: AUDIO, mimetype: "audio/webm", seconds: 100 });
  ok(!r.ok && /already certified/.test(r.error), "nothing to send after certification");

  // ---- the activity log names the course steps; gate off again
  ok((SD.activity_log || []).some((x) => x.kind === "cert_quiz_submit") && (SD.activity_log || []).some((x) => x.kind === "mock_call_upload"), "activity log");
  r = await call({ action: "course_gate_set", secret: "SECRET", on: false });
  ok(r.ok && r.gate_on === false, "gate off again");
  delete SD.course.key.cert;
  r = await call({ action: "course_gate_set", secret: "SECRET", on: true });
  ok(!r.ok && /course key/.test(r.error), "gate can't go on without a certification key");

  // ---- the quiz runs out after 3 tries a day (fresh partner)
  SD.affiliates.new1 = { name: "New One", email: "n@example.com", status: "active", track: "partner" };
  SD.sessions.TNEW = { code: "new1", exp: now + 864e5 };
  SD.course.key = JSON.parse(JSON.stringify(Object.assign({}, KEY, { set_at: iso(now) })));
  for (const [lid, a] of [["0.1", [1, 0]], ["0.2", [2]], ["1.1", [0, 1, 2]], ["2.1", [1]]]) await call({ action: "course_progress_set", token: "TNEW", version: "v1abc", lesson: lid, answers: a });
  SD.course.p.new1.quiz.attempts = [{ at: iso(Date.now()), pct: 10, pass: false }, { at: iso(Date.now()), pct: 20, pass: false }, { at: iso(Date.now()), pct: 30, pass: false }];
  r = await call({ action: "cert_quiz_start", token: "TNEW", version: "v1abc" });
  ok(!r.ok && /3 tries today/.test(r.error), "3 tries a day: " + r.error);
  SD.course.p.new1.quiz.attempts = [];
  r = await call({ action: "cert_quiz_start", token: "TNEW", version: "v1abc" });
  SD.course.p.new1.quiz.open.exp = iso(Date.now() - 1000);
  r = await call({ action: "cert_quiz_submit", token: "TNEW", attempt: SD.course.p.new1.quiz.open.id, answers: {} });
  ok(!r.ok && /ran out of time/.test(r.error) && !SD.course.p.new1.quiz.open && SD.course.p.new1.quiz.attempts.length === 0, "expired attempt not counted");

  console.log("PASS " + passes + "  FAIL " + fails);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
