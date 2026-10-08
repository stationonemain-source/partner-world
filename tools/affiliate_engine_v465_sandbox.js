// Sandbox for the v4.65 Affiliate Logic (patch_affiliate_engine_v465_missing.py --offline): n8n inputs and every HTTP call are
// stubbed; nothing leaves this process. Usage: node affiliate_engine_v465_sandbox.js v465.js  ->  "PASS n  FAIL 0"
const fs = require("fs");
const SRC = fs.readFileSync(process.argv[2] || "v465.js", "utf8");
const RUN = new Function("$input", "$env", "$getWorkflowStaticData", "return (async function(){\n" + SRC + "\n}).call(this);");
const ENV = { STATION_BROKER_URL: "https://broker.test/x", STATION_BROKER_SECRET: "SECRET", STATION_AFFIL_PUB_TOKEN: "PUB",
  STATION_DISCORD_WEBHOOK: "https://discord.test/wh", STATION_GHL_HQ_LOCATION: "HQLOC", STATION_STRIPE_RK_AFFIL: "rk_test_x",
  STATION_STRIPE_CONNECT_KEY: "rk_test_c", STATION_DISCORD_WEBHOOK_2: "" };
let REQ = [], FIX = {};
function resetFix() {
  FIX = { dup: {}, byId: {}, convs: {}, slots: {}, book: {}, search: {}, msgFail: 0, catalogue: { products: [{ sku: "lineback", name: "Lineback", mrr: 197 }], bundles: [{ key: "answer", name: "Answer", mrr: 297 }] } };
}
resetFix();
async function httpRequest(o) {
  const url = String(o.url), m = (o.method || "GET").toUpperCase();
  REQ.push({ m, url, body: o.body });
  const full = (x, sc) => o.returnFullResponse ? { statusCode: sc || 200, body: x } : x;
  if (url.startsWith("https://broker.test")) return { locationToken: "TOK" };
  if (url.startsWith("https://discord.test")) return {};
  if (url.indexOf("products.json") >= 0) return FIX.catalogue;
  if (url.indexOf("leadconnectorhq.com") >= 0) {
    const p = url.split("leadconnectorhq.com")[1];
    if (p.startsWith("/contacts/search/duplicate")) {
      const em = decodeURIComponent((p.match(/email=([^&]+)/) || [])[1] || ""), ph = decodeURIComponent((p.match(/number=([^&]+)/) || [])[1] || "");
      const c = FIX.dup[em] || FIX.dup[ph]; return c ? { contact: c } : {};
    }
    if (p === "/contacts/search" && m === "POST") {
      const f = (o.body.filters || [])[0] || {};
      if (f.field === "tags") return { contacts: FIX.book[f.value] || [] };
      if (f.field === "email") return { contacts: FIX.search[f.value] || [] };
      return { contacts: [] };
    }
    if (p.startsWith("/contacts/?locationId")) return { contacts: [] };
    if (p === "/contacts/" && m === "POST") return full({ contact: { id: "cNEW", email: o.body.email } });
    if (/^\/contacts\/[^/]+\/tags$/.test(p)) return {};
    if (/^\/contacts\/[^/?]+$/.test(p) && m === "GET") { const id = p.split("/")[2]; return { contact: FIX.byId[id] || { id: id, tags: [] } }; }
    if (/^\/contacts\/[^/?]+$/.test(p) && m === "PUT") return {};
    if (p.startsWith("/conversations/search")) { const c = decodeURIComponent((p.match(/contactId=([^&]+)/) || [])[1] || ""); return { conversations: FIX.convs[c] || [] }; }
    if (p === "/conversations/messages" && m === "POST") {
      if (FIX.msgFail) { FIX.msgFail--; return full({ message: "nope" }, 500); }
      return full({ messageId: "MSG" + REQ.length, conversationId: "CV1" });
    }
    if (/^\/calendars\/[^/]+\/free-slots/.test(p)) return FIX.slots;
    if (p === "/calendars/events/appointments" && m === "POST") return { id: "APPT" + REQ.length, address: "" };
    return {};
  }
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
const pad = (n) => (n < 10 ? "0" : "") + n;
function chiIso(ms) { const d = new Date(ms - 5 * 3600000); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":00-05:00"; }
const mails = () => REQ.filter((x) => /conversations\/messages$/.test(x.url) && x.m === "POST");
const tagsPosts = () => REQ.filter((x) => /\/contacts\/[^/]+\/tags$/.test(x.url) && x.m === "POST");

(async function () {
  const now = Date.now();
  function fresh() {
    SD = {
      affiliates: {
        pat: { name: "Pat Example", email: "pat@example.com", status: "active", track: "partner", state: "NY", tz: "America/New_York", calendarId: "calPAT" },
        sam: { name: "Sam Second", email: "sam@example.com", status: "active", track: "partner", tz: "America/Chicago" },
        pend: { name: "Penny Pending", email: "penny@example.com", status: "pending", track: "partner" },
      },
      sessions: { TPAT: { code: "pat", exp: now + 864e5 }, TSAM: { code: "sam", exp: now + 864e5 } },
      attributions: [], slots: [], templates: [], site_sends: [], demo_jobs: [], loginfails: {}, lead_jobs: [], notes: {},
      leads: [
        { id: "s-a-1", pid: "a", code: "pat", source: "station", name: "Acme Plumbing", phone: "(512) 555-0101", city: "Austin", state: "TX", until: now + 10 * 864e5, attempts: [{ at: iso(now - 864e5), result: "talked" }], outcome: "interested" },
        { id: "s-b-1", pid: "b", code: "pat", source: "station", name: "Bolt HVAC", phone: "2125550102", email: "owner@bolt.test", state: "NY", until: now + 10 * 864e5, attempts: [], outcome: "" },
        { id: "s-c-1", pid: "c", code: "pat", source: "station", name: "Cobble Roof", phone: "2125550103", email: "stop@cobble.test", until: now + 10 * 864e5, attempts: [], outcome: "dnc", blocks: { dnc: iso(now) } },
      ],
    };
  }
  fresh();
  let r;

  // ---- 1. referral numbers
  r = await call({ action: "me", token: "TPAT" });
  ok(r.ok && r.ref && r.ref.counting === false && r.ref.visits === 0 && r.ref.link === "https://www.station.solutions/?ref=pat" && r.claims_open === 0, "me.ref before any visit: " + JSON.stringify(r.ref));
  r = await call({ action: "attribute", pub: "PUB", code: "pat", kind: "visit", label: "/" });
  r = await call({ action: "attribute", pub: "PUB", code: "pat", kind: "audit-submit", label: "v5-form" });
  r = await call({ action: "attribute", pub: "PUB", code: "sam", kind: "visit", label: "/" });
  r = await call({ action: "me", token: "TPAT" });
  ok(r.ref.counting === true && r.ref.visits === 1 && r.ref.visits_30d === 1 && r.ref.forms === 1 && r.ref.kinds["audit-submit"] === 1, "me.ref counts visits + forms: " + JSON.stringify(r.ref));
  ok(!!SD.ref_seen_at, "attribute stamps ref_seen_at");

  // ---- 3. Add a client
  r = await call({ action: "client_claim", token: "TPAT", business: "", email: "a@b.co", product: "answer" });
  ok(!r.ok && /business name/.test(r.error), "claim needs a business");
  r = await call({ action: "client_claim", token: "TPAT", business: "Zed Dental", email: "nope", product: "answer" });
  ok(!r.ok && /email/.test(r.error), "claim needs an email");
  r = await call({ action: "client_claim", token: "TPAT", business: "Zed Dental", email: "zed@dental.test", product: "notathing" });
  ok(!r.ok && /Pick a product/.test(r.error), "claim refuses an unknown product: " + r.error);
  r = await call({ action: "client_claim", token: "TPAT", business: "Zed Dental", email: "zed@dental.test", product: "lineback", lead: "s-x" });
  ok(!r.ok && /isn't on your list/.test(r.error), "claim refuses someone else's lead id");
  r = await call({ action: "client_claim", token: "TPAT", business: "Stop Roof", email: "stop@cobble.test", product: "answer" });
  ok(!r.ok && /asked not to be contacted/.test(r.error), "claim refuses a Do-not-call business");
  REQ = [];
  r = await call({ action: "client_claim", token: "TPAT", business: "Zed Dental", name: "Zoe Zed", email: "Zed@Dental.test", phone: "(512) 555-0199", product: "answer", note: "Signed up on the Answer page" });
  ok(r.ok && r.claim.status === "pending" && r.claim.email === "zed@dental.test" && SD.client_claims.length === 1 && r.claims_open === 1, "claim saved pending: " + JSON.stringify(r).slice(0, 200));
  ok(REQ.some((x) => /discord\.test/.test(x.url)) && !tagsPosts().length && !mails().length, "a claim pings Station, tags nothing, emails nobody");
  r = await call({ action: "client_claim", token: "TPAT", business: "Zed Dental", email: "zed@dental.test", product: "answer" });
  ok(!r.ok && /already asked/.test(r.error), "duplicate claim refused (own)");
  r = await call({ action: "client_claim", token: "TSAM", business: "Zed", email: "zed@dental.test", product: "answer" });
  ok(!r.ok && /already looking/.test(r.error) && !/pat/i.test(r.error), "duplicate claim refused without naming the partner");
  r = await call({ action: "client_claim", token: "nope", business: "Q", email: "q@q.co", product: "answer" });
  ok(!r.ok, "claim needs a session");
  r = await call({ action: "client_add", token: "TPAT", name: "X", email: "x@x.co", bundle: "answer" });
  ok(!r.ok && r.refused === "claim" && /Add a client/.test(r.error), "client_add is closed (agreement 6.2): " + r.error);
  r = await call({ action: "client_claims", secret: "WRONG" });
  ok(!r.ok, "client_claims needs the secret");
  r = await call({ action: "client_claims", secret: "SECRET", status: "pending" });
  ok(r.ok && r.claims.length === 1 && r.claims[0].partner === "Pat Example" && r.claims[0].code === "pat", "client_claims lists pending");
  const cid = SD.client_claims[0].id;
  r = await call({ action: "client_claim_decide", secret: "SECRET", id: cid, decision: "decline", reason: "" });
  ok(!r.ok && /Say why/.test(r.error), "decline needs a reason");
  // another partner already owns that email in the CRM -> refused, nothing written
  FIX.dup["zed@dental.test"] = { id: "cZED", tags: ["client", "aff-sam"] };
  REQ = [];
  r = await call({ action: "client_claim_decide", secret: "SECRET", id: cid, decision: "accept" });
  ok(!r.ok && /another partner's book/.test(r.error) && !tagsPosts().length && SD.client_claims[0].status === "pending", "accept refuses another partner's client: " + r.error);
  FIX.dup["zed@dental.test"] = { id: "cZED", tags: ["lead"] };
  REQ = [];
  r = await call({ action: "client_claim_decide", secret: "SECRET", id: cid, decision: "accept", bundle: "answer", by: "Ewan" });
  const tp = tagsPosts()[0];
  ok(r.ok && tp && /cZED\/tags$/.test(tp.url) && JSON.stringify(tp.body.tags) === JSON.stringify(["aff-pat", "client", "station-answer"]), "accept adds aff-pat + client (+ bundle) by the additive endpoint: " + JSON.stringify(tp && tp.body));
  ok(!REQ.some((x) => /\/contacts\/upsert/.test(x.url)), "accept never calls /contacts/upsert");
  ok(SD.client_claims[0].status === "accepted" && SD.affiliates.pat.book_since["zed@dental.test"], "accept records status + book_since");
  ok(mails().length === 1 && mails()[0].body.emailTo === "pat@example.com" && /added Zed Dental/.test(mails()[0].body.subject) && SD.pw_mail_log.length === 1, "partner told by a ledgered email");
  r = await call({ action: "client_claim_decide", secret: "SECRET", id: cid, decision: "accept" });
  ok(!r.ok && /already accepted/.test(r.error), "a decided claim can't be decided again");
  r = await call({ action: "client_claim", token: "TPAT", business: "Yew Salon", email: "yew@salon.test", product: "unsure" });
  REQ = [];
  r = await call({ action: "client_claim_decide", secret: "SECRET", id: SD.client_claims[1].id, decision: "decline", reason: "They signed up directly before your call." });
  ok(r.ok && SD.client_claims[1].status === "declined" && !tagsPosts().length && mails().length === 1, "decline: no tags, partner emailed");

  // ---- 2. What's new
  FIX.dup["pat@example.com"] = { id: "cPAT" };
  FIX.convs.cPAT = [{ id: "cv1", lastMessageDirection: "outbound", lastMessageType: "TYPE_EMAIL", lastMessageDate: now - 3600e3 },
    { id: "cv2", lastMessageDirection: "outbound", lastMessageType: "TYPE_LIVE_CHAT", lastMessageDate: now - 60e3 }];
  r = await call({ action: "pw_news", token: "TPAT" });
  ok(r.ok && r.claims.length === 2 && r.claims[0].status === "declined" && r.events.length === 2 && r.station_wrote && Date.parse(r.station_wrote.at) === now - 3600e3, "pw_news: claims, events, Station's last email (chat ignored): " + JSON.stringify(r).slice(0, 300));
  const before = JSON.stringify(SD);
  r = await call({ action: "pw_news", token: "TPAT", mail: false });
  ok(r.ok && r.station_wrote === null && r.station_wrote_read === "skipped" && JSON.stringify(SD) === before, "pw_news is a pure read; mail:false skips the GHL read");
  r = await call({ action: "pw_news", token: "TSAM" });
  ok(r.ok && r.claims.length === 0 && r.events.length === 0, "pw_news shows a partner only their own");
  // client_alert -> one event + one email per sale, even when two workflows fire
  FIX.search["buyer@shop.test"] = [{ id: "cBUY", tags: ["client", "aff-pat"], contactName: "Buyer Shop" }];
  REQ = [];
  r = await call({ action: "client_alert", secret: "SECRET", email: "buyer@shop.test", title: "A client of yours just purchased", client: "Buyer Shop", text: "x" });
  r = await call({ action: "client_alert", secret: "SECRET", email: "buyer@shop.test", title: "Setup needed on a client's product", client: "Buyer Shop", text: "y" });
  const ev = SD.pw_events.filter((e) => e.kind === "purchase" || e.kind === "setup");
  ok(ev.length === 1 && /Buyer Shop bought/.test(ev[0].title) && mails().filter((x) => x.body.emailTo === "pat@example.com").length === 1, "purchase: one event and one email: " + JSON.stringify(ev));
  // the ceiling: 12 notices to one partner per Chicago day
  const day = new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  for (let i = 0; i < 12; i++) SD.pw_mail_log.push({ code: "sam", day: day, at: iso(now), status: "sent", subject: "x" });
  SD.client_claims.push({ id: "cl-sam", code: "sam", business: "Sam Biz", email: "sam@biz.test", product: "answer", at: iso(now), status: "pending" });
  REQ = [];
  r = await call({ action: "client_claim_decide", secret: "SECRET", id: "cl-sam", decision: "decline", reason: "Not a fit for Station." });
  ok(r.ok && r.mail === "capped" && !mails().length, "notice emails stop at the per-partner ceiling: " + r.mail);

  // ---- 5. lead_book confirms to the business from the cold lane
  FIX.slots = {};
  const start = chiIso(now + 2 * 864e5 + 3600e3);
  FIX.dup["owner@bolt.test"] = { id: "cBOLT", tags: [] };
  FIX.byId.cBOLT = { id: "cBOLT", tags: [], dndSettings: {} };
  REQ = [];
  r = await call({ action: "lead_book", token: "TPAT", id: "s-b-1", start: start });
  const lm = mails().filter((x) => x.body.emailTo === "owner@bolt.test");
  ok(r.ok && r.lead_mail && r.lead_mail.sent === true && lm.length === 1, "lead_book emails the business: " + JSON.stringify(r.lead_mail));
  ok(lm[0] && lm[0].body.emailFrom === "Station Team <hello@send.station.solutions>" && !/main@station/.test(JSON.stringify(lm[0].body)), "from the cold lane, never main@");
  ok(lm[0] && !/https?:\/\//.test(lm[0].body.message) && /Eastern time/.test(lm[0].body.message) && /Pat, an independent partner/.test(lm[0].body.message), "plain, no link, in the lead's time zone (NY): " + (lm[0] && lm[0].body.message));
  ok(SD.lb_mail_log.length === 1 && SD.lb_mail_log[0].status === "sent", "ledger row written");
  ok(mails().some((x) => x.body.emailTo === "pat@example.com" && /Booked: Bolt HVAC/.test(x.body.subject)), "the partner still gets their booking email (through pwMail)");
  // a lead with no email: the partner's typed address is kept, Austin TX = Central
  FIX.dup["new@acme.test"] = { id: "cACME", tags: [] };
  FIX.byId.cACME = { id: "cACME", tags: ["cold-stop-optout"] };
  REQ = [];
  r = await call({ action: "lead_book", token: "TPAT", id: "s-a-1", start: chiIso(now + 3 * 864e5), email: "new@acme.test" });
  ok(r.ok && SD.leads[0].email === "new@acme.test" && r.lead_mail.sent === false && r.lead_mail.why === "opted_out" && !mails().some((x) => x.body.emailTo === "new@acme.test"), "an opted-out address gets no confirmation: " + JSON.stringify(r.lead_mail));
  // per-address ceiling: 3 in 7 days
  SD.leads[1].booked = null;
  SD.lb_mail_log.push({ code: "pat", to: "owner@bolt.test", day: "2000-01-01", at: iso(now - 864e5), status: "sent" }, { code: "pat", to: "owner@bolt.test", day: "2000-01-01", at: iso(now - 2 * 864e5), status: "sent" });
  r = await call({ action: "lead_book", token: "TPAT", id: "s-b-1", start: chiIso(now + 4 * 864e5) });
  ok(r.ok && r.lead_mail.sent === false && r.lead_mail.why === "capped", "3 confirmations per address per week: " + JSON.stringify(r.lead_mail));

  // ---- 4. calls with Station
  const s1 = chiIso(now + 864e5), s2 = chiIso(now + 864e5 + 1800e3);
  FIX.slots = { [s1.slice(0, 10)]: { slots: [s1, s2] }, traceId: "x" };
  REQ = [];
  r = await call({ action: "st_slots", token: "TPAT", for: "me" });
  ok(r.ok && r.days.length === 1 && r.days[0].slots.length === 2 && REQ.some((x) => /calendars\/unT6rF2jVTabl1ki7NUs\/free-slots/.test(x.url)), "st_slots reads Station's support calendar: " + JSON.stringify(r).slice(0, 200));
  r = await call({ action: "st_book", token: "TPAT", for: "me", start: s1, topic: "hi" });
  ok(!r.ok && /what the call is about/.test(r.error), "st_book needs a topic");
  r = await call({ action: "st_book", token: "TPAT", for: "me", start: chiIso(now + 600e3), topic: "How do I pitch Core?" });
  ok(!r.ok && /2 hours/.test(r.error), "st_book needs 2 hours' notice");
  REQ = [];
  r = await call({ action: "st_book", token: "TPAT", for: "me", start: s1, topic: "How do I pitch Core to a dentist?" });
  const ap = REQ.find((x) => /appointments$/.test(x.url));
  ok(r.ok && ap && ap.body.calendarId === "unT6rF2jVTabl1ki7NUs" && /^Partner call: Pat Example/.test(ap.body.title), "st_book books Station: " + JSON.stringify(r).slice(0, 200));
  ok(SD.cal_bookings.some((x) => x.who === "station-self" && x.topic === "How do I pitch Core to a dentist?"), "st_book is recorded");
  r = await call({ action: "st_book", token: "TPAT", for: "client", contactId: "cNOTMINE", start: s2, topic: "Their reviews stopped" });
  ok(!r.ok && /isn't in your book/.test(r.error), "a client call needs a client in the book");
  FIX.book["aff-pat"] = [{ id: "cBUY", email: "buyer@shop.test", tags: ["client", "aff-pat"], contactName: "Buyer Shop" }];
  r = await call({ action: "st_book", token: "TPAT", for: "client", contactId: "cBUY", start: s2, topic: "Their reviews stopped going out" });
  ok(r.ok && r.booked.for === "client" && SD.cal_bookings.some((x) => x.who === "station-client" && x.contactId === "cBUY"), "client support call booked: " + JSON.stringify(r).slice(0, 160));
  SD.cal_bookings.push({ id: "cb-x", code: "pat", start: chiIso(now + 5 * 864e5), who: "station-self" });
  r = await call({ action: "st_book", token: "TPAT", for: "me", start: chiIso(now + 6 * 864e5), topic: "Another question" });
  ok(!r.ok && /3 calls with Station/.test(r.error), "at most 3 upcoming calls with Station");
  r = await call({ action: "pw_news", token: "TPAT", mail: false });
  ok(r.bookings.some((x) => x.who === "station-client") && r.bookings.some((x) => x.who === "lead"), "pw_news lists bookings");
  r = await call({ action: "st_cal_set", secret: "SECRET", me: "LVkIlCPKw8ehhXNGplTb" });
  ok(r.ok && r.st_cal.me === "LVkIlCPKw8ehhXNGplTb" && r.st_cal.client === "unT6rF2jVTabl1ki7NUs", "st_cal_set points one kind elsewhere");
  r = await call({ action: "st_cal_set", secret: "SECRET", me: "bad id!" });
  ok(!r.ok, "st_cal_set refuses a bad id");

  // ---- admin pw_event_add
  r = await call({ action: "pw_event_add", secret: "SECRET", code: "pat", kind: "reply", title: "Station answered your message" });
  ok(r.ok && r.event.kind === "reply", "pw_event_add posts");
  r = await call({ action: "pw_event_add", secret: "SECRET", code: "pat", kind: "hack", title: "x" });
  ok(!r.ok, "pw_event_add refuses unknown kinds");
  r = await call({ action: "pw_event_add", code: "pat", kind: "reply", title: "x" });
  ok(!r.ok, "pw_event_add needs the secret");

  // ---- tax form type
  r = await call({ action: "taxform_submit", token: "TPAT", type: "W-8BEN", filename: "f.pdf", mimetype: "application/pdf", filedata: Buffer.from("x").toString("base64") });
  ok(r && r._route === "upload" && r.aType === "W-8BEN", "W-8BEN accepted: " + JSON.stringify(r).slice(0, 120));
  r = await call({ action: "taxform_submit", token: "TPAT", type: "w9", filename: "f.pdf", mimetype: "application/pdf", filedata: Buffer.from("x").toString("base64") });
  ok(r && r.aType === "W-9", "w9 normalised to W-9");
  r = await call({ action: "taxform_submit", token: "TPAT", type: "1099", filename: "f.pdf", mimetype: "application/pdf", filedata: Buffer.from("x").toString("base64") });
  ok(r && r.ok === false && /W-9 \(U\.S\.\) or W-8BEN/.test(r.error), "another form type refused");

  // ---- pending partners are refused everywhere new
  SD.sessions.TPEND = { code: "pend", exp: now + 864e5 };
  for (const a of ["pw_news", "client_claim", "st_slots", "st_book"]) { r = await call({ action: a, token: "TPEND" }); ok(!r.ok, a + " refuses a pending partner"); }

  console.log("PASS " + passes + "  FAIL " + fails);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("CRASH", e && e.stack); process.exit(2); });
