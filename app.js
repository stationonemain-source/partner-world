/* Station Partner World. Every Station fact comes from window.PW (built from the live partner guide and product list,
   with Partner World's script corrections from script_fixes.py).

   Two modes:
   - LIVE (the default): the partner signs in with the email and password of their Station partner account, and works
     the businesses Station dealt them. Leads, call results, notes, "ask for more" and money all come from and go to
     Station's partner engine (the same one the old station.solutions/partners portal uses), so both portals agree.
     The engine is the only record; this browser keeps view preferences, the sign-in token and a queue of results
     that haven't reached the engine yet.
   - PREVIEW (?demo or ?preview): SAMPLE data, fictional businesses with reserved 555-01xx numbers, labelled on screen;
     nothing is sent anywhere. The tests and Circle's phone link run here.

   How a call works (09-29 UX pass): each lead card carries its own pitch and opener. "Call now" opens a short
   "Ready to call" card (the lines to say, speaker tip), then the phone. When the partner comes back to the app,
   "How did it go?" opens by itself. Every save can be undone for a few seconds; in LIVE mode a result is only sent
   to Station once its Undo has gone, so Undo never has to take anything back from the engine. */
(function () {
  'use strict';
  var PW = window.PW, KEY = 'pw-preview-v2';
  var API = 'https://n8n.srv1748596.hstgr.cloud/webhook/station-affiliates', TKEY = 'pw-token';
  var Q0 = new URLSearchParams(location.search);
  /* the preview sticks for this tab only (a reload, the hash routes), never for the next visit: the bare address always means sign in */
  var DEMO = Q0.has('demo') || Q0.has('preview') || (function () { try { return sessionStorage.getItem('pw-demo') === '1'; } catch (e) { return false; } })();
  if (DEMO) { try { sessionStorage.setItem('pw-demo', '1'); } catch (e) {} }
  if (!DEMO) KEY = 'pw-live-v1';
  var TOKEN = ''; if (!DEMO) { try { TOKEN = localStorage.getItem(TKEY) || ''; } catch (e) {} }
  var main = document.getElementById('main');
  var BOX = {}; PW.boxes.forEach(function (b) { BOX[b.id] = b; });
  function fresh() { return { name: '', code: '', entered: false, log: {}, notes: {}, pitch: {}, focus: '', focusDay: '', filter: 'all', asked: false, big: false, toured: false, skipPrep: false, calls: [], since: '', askedAt: 0, demo: DEMO, outbox: [] }; }

  /* ---------- state: PREVIEW = everything, this browser only; LIVE = view preferences + the unsent queue (the engine holds the rest) ---------- */
  var S = fresh();
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (DEMO) S.demo = true;
  if (!Array.isArray(S.outbox)) S.outbox = [];
  ['notes', 'pitch', 'log'].forEach(function (k) { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
  if (!Array.isArray(S.calls)) S.calls = [];
  Object.keys(S.log).forEach(function (k) {
    var x = S.log[k];
    if (!x || typeof x !== 'object' || typeof x.o !== 'string') { delete S.log[k]; return; }
    if (x.due != null && typeof x.due !== 'string') delete x.due;
  });
  S.calls = S.calls.filter(function (x) { return x && typeof x === 'object' && typeof x.id === 'string'; });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var STORE_OK = (function () { try { localStorage.setItem(KEY + '-t', '1'); localStorage.removeItem(KEY + '-t'); return true; } catch (e) { return false; } })();
  var banner = document.querySelector('.preview');
  if (DEMO) banner.innerHTML = (STORE_OK ? 'Preview · sample businesses and money, nothing is sent to Station' : 'Preview · this browser can’t save, so nothing you do here is kept after you leave') +
    ' · <button class="link-btn" type="button" id="leavePreview">Sign in for real</button>';
  banner.hidden = !DEMO; // LIVE: the banner only appears when results are waiting to reach Station (syncLine)
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- preview links: ?demo skips the welcome form and the check (optional &name=Linda, &code=lsmith); ?preview starts at the welcome form ---------- */
  (function () {
    if (!DEMO) return;
    var q = Q0;
    if (q.has('preview') && !q.has('demo')) { save(); return; } // ?preview stays in the address, so a reload is still the preview
    if (!q.has('demo')) return;
    var name = (q.get('name') || '').trim().slice(0, 40), c = (q.get('code') || '').trim().toLowerCase();
    if (name) S.name = name; else if (!S.name) S.name = 'Sam';
    if (/^[a-z0-9-]{2,30}$/.test(c)) S.code = c; else if (!S.code) S.code = 'demo';
    S.entered = true; save();
    history.replaceState(null, '', location.pathname + (location.hash && location.hash !== '#' ? location.hash : '#home'));
  })();
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#leavePreview')) return;
    try { sessionStorage.removeItem('pw-demo'); } catch (er) {} location.href = location.pathname; // the preview's own data stays in its own key; LIVE never reads it
  });

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function toast(t, ms) {
    var el = document.getElementById('toast');
    el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, ms || 2000);
    toast.keep = ms && ms > 2000 ? Date.now() + ms : 0;
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p || 15); } catch (e) {} }
  function code() { return (S.code || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); }
  function brandName() { return 'Station'; }
  var MARK = '<svg class="mark" viewBox="0 0 100 100" aria-hidden="true"><use href="#stationMark"/></svg>';
  function perMonth(b) { return b.earn; }
  function period(b) { return 'month'; }
  var TD = PW.trialDays || 14;
  function kindWord(b) { return b.kind === 'plan' ? 'plan' : 'collection'; }
  function linkFor(b) { return b.link.replace('{code}', code()); }
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function copy(text, btn) {
    function done(ok) { if (btn) { var o = btn.getAttribute('data-label') || btn.textContent; btn.setAttribute('data-label', o); btn.textContent = ok ? 'Copied' : 'Select and copy'; setTimeout(function () { btn.textContent = o; }, 1800); } }
    try { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
  }

  /* ---------- text size (A / A+), remembered on this device ---------- */
  function applySize() {
    document.documentElement.classList.toggle('big', !!S.big);
    document.querySelectorAll('[data-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!S.big)); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-size]'); if (!b) return;
    S.big = !S.big; save(); applySize(); sizeFeed(); toast(S.big ? 'Bigger text on.' : 'Normal text.');
  });
  applySize();

  /* ---------- dates (the partner's own calendar) ---------- */
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function today() { return ymd(new Date()); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return ymd(d); }
  function dayLabel(s) {
    if (s === today()) return 'today';
    if (s === ymd(new Date(Date.now() + 864e5))) return 'tomorrow';
    if (s === ymd(new Date(Date.now() - 864e5))) return 'yesterday';
    return new Date(s + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /* ---------- sample leads: fictional businesses, reserved 555-01xx numbers with real area codes ---------- */
  var HOLD_DAYS = 14; // Circle, 10-03: a business you haven't finished goes back to Station's shared list after 14 days
  var SAMPLE = [
    ['s1', 'Bayou City Plumbing Co.', 'Plumbing', 'Houston', 'TX', '713', 4.6, 23, 'Answers their own phone; the listing says “call for same-day service.”', 'lineback'],
    ['s2', 'Red River Roofing', 'Roofing', 'Tulsa', 'OK', '918', 4.8, 61, 'Storm season. Lots of calls come in while crews are on roofs.', 'frontdesk'],
    ['s3', 'Magnolia Home Cleaning', 'House cleaning', 'Katy', 'TX', '281', 4.9, 14, 'Great rating, only 14 reviews.', 'repute'],
    ['s4', 'Lone Star HVAC Service', 'HVAC', 'Sugar Land', 'TX', '281', 4.4, 38, 'No online booking; “call us to schedule.”', 'slate'],
    ['s5', 'Prairie Fitness Studio', 'Gym', 'Norman', 'OK', '405', 4.7, 52, 'Books classes by phone and text.', 'slate'],
    ['s6', 'Gulf Breeze Pest Control', 'Pest control', 'Pasadena', 'TX', '713', 4.2, 19, 'Their website looks years out of date and is hard to use on a phone.', 'website'],
    ['s7', 'Cedar Bend Auto Glass', 'Auto glass', 'Round Rock', 'TX', '512', 4.8, 9, 'Nine reviews; a nearby competitor has over a hundred.', 'repute'],
    ['s8', 'Summit Electric LLC', 'Electrician', 'Edmond', 'OK', '405', 4.5, 27, 'Owner-operator who answers the business line between jobs.', 'dial'],
    ['s9', 'Clearwater Pool Care', 'Pool service', 'Cypress', 'TX', '281', 4.6, 33, 'Gets quote requests; follow-up is unclear.', 'pursuit'],
    ['s10', 'Oak & Iron Fence Co.', 'Fencing', 'Moore', 'OK', '405', 4.3, 12, 'Short, generic Google listing.', 'echo'],
    ['s11', 'Brightside Dental Care', 'Dental', 'Pearland', 'TX', '281', 4.9, 88, 'Long list of past patients; recalls are done by phone.', 'dispatch'],
    ['s12', 'Hill Country Landscaping', 'Landscaping', 'Austin', 'TX', '512', 4.5, 21, 'Seasonal work; winter is slow.', 'revive'],
    ['s13', 'Metro Commercial Cleaning', 'Commercial cleaning', 'Dallas', 'TX', '214', 4.4, 17, 'Sells to offices and property managers.', 'radar'],
    ['s14', 'Riverbend Salon', 'Hair salon', 'Broken Arrow', 'OK', '918', 4.8, 104, 'Busy, lots of website visitors, no chat.', 'greet'],
    ['s15', 'Big Tex Handyman', 'Handyman', 'Conroe', 'TX', '936', 4.1, 8, 'Invoices on paper, takes checks.', 'tap'],
    ['s16', 'Sunrise Chiropractic', 'Chiropractor', 'Tulsa', 'OK', '918', 4.7, 45, 'Posts on Facebook a few times a year.', 'marquee'],
    ['s17', 'Northside Garage Doors', 'Garage doors', 'Spring', 'TX', '281', 4.6, 30, 'Emergency repairs; calls come in after hours.', 'frontdesk'],
    ['s18', 'Pecan Street Pet Grooming', 'Pet grooming', 'Stillwater', 'OK', '405', 4.9, 67, 'Books by phone while grooming.', 'lineback']
  ].map(function (r, i) {
    var last = '01' + ('0' + (i + 1)).slice(-2);
    return { id: r[0], name: r[1], trade: r[2], city: r[3], st: r[4], rating: r[6], reviews: r[7], gap: r[8], fits: r[9],
      phone: '(' + r[5] + ') 555-' + last, dial: '+1' + r[5] + '555' + last, days: HOLD_DAYS }; // one batch, all dealt the same day
  });
  var LEADS = DEMO ? SAMPLE : [], LEAD = {};
  function indexLeads() { LEAD = {}; LEADS.forEach(function (l) { LEAD[l.id] = l; }); }
  indexLeads();
  if (!S.since) { S.since = ymd(new Date()); save(); }
  /* LIVE leads carry the engine's own hand-back time (until); the preview counts from the day it was opened */
  function daysLeft(l) {
    if (l.until) return Math.max(1, Math.ceil((l.until - Date.now()) / 864e5));
    var gone = Math.round((new Date(today() + 'T12:00') - new Date(S.since + 'T12:00')) / 864e5); return Math.max(1, l.days - Math.max(0, gone));
  }
  function untilDate(l) { return l.until ? new Date(l.until) : new Date(Date.now() + daysLeft(l) * 864e5); }
  var TZ = {};
  [['America/New_York', 'CT DE DC FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV'], ['America/Chicago', 'AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI'],
   ['America/Denver', 'CO MT NM UT WY ID'], ['America/Phoenix', 'AZ'], ['America/Los_Angeles', 'CA NV OR WA'], ['America/Anchorage', 'AK'], ['Pacific/Honolulu', 'HI']
  ].forEach(function (z) { z[1].split(' ').forEach(function (st) { TZ[st] = z[0]; }); });

  function localTime(st) {
    var tz = TZ[st], now = new Date(), p = {};
    if (!tz) return { text: '', ok: false, why: 'Check their local time first', opens: 'once you know their time', sun: false, early: false, hour: -1, laterOk: false, unknown: true };
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    var h = +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now) % 24;
    var sun = p.weekday === 'Sun', ok = !sun && h >= 9 && h < 20, why = '', opens = '';
    if (sun) { why = 'No calls on Sundays'; opens = 'Monday at 9 am'; }
    else if (h < 9) { why = 'Too early to call'; opens = 'today at 9 am'; }
    else if (h >= 20) { why = 'Too late to call'; opens = p.weekday === 'Sat' ? 'Monday at 9 am' : 'tomorrow at 9 am'; }
    return { text: p.hour + ':' + p.minute + ' ' + p.dayPeriod.toLowerCase(), ok: ok, why: why, opens: opens, sun: sun, early: !sun && h < 9, hour: h,
      laterOk: !sun && h >= 9 && h + 3 < 20 }; // a "later today" call-back (in 3 hours) must land inside calling hours, and only be offered during them
  }

  function timeLine(t) { return t.unknown ? 'Check their local time before you call' : (t.ok ? 'OK to call now' : t.why) + ' · it’s ' + t.text + ' there'; }

  /* ---------- what each business gets pitched: your pick for that card, else the product you chose to focus on, else its best fit ---------- */
  function sellable(b) { return !!b; }
  function pitchFor(l) {
    if (sellable(BOX[S.pitch[l.id]])) return BOX[S.pitch[l.id]];
    var s = S.log[l.id];
    if (s && (TALKED[s.o] || s.wasInterested) && sellable(BOX[s.box])) return BOX[s.box];
    if (sellable(BOX[S.focus]) && S.focusDay === today()) return BOX[S.focus];
    return BOX[l.fits];
  }

  /* ---------- lead status ----------
     Follow-ups (No answer, Voicemail, Interested, Call back) stay on the list. Only a closed outcome finishes a lead,
     and a finished lead can't be called from the app. Order: call-backs due today, new, to try again, finished. */
  var OUT = { noanswer: 'No answer', voicemail: 'Voicemail', bad: 'Bad lead', interested: 'Interested', callback: 'Call back', notint: 'Not interested', dnc: 'Do not call', won: 'Won', called: 'Called' }; // called: logged in the old portal
  var CLOSED = { bad: 1, notint: 1, dnc: 1, won: 1 };
  var TALKED = { interested: 1, callback: 1, notint: 1, dnc: 1, won: 1, talked: 1 }; // talked: an earlier conversation in the engine's call history
  function triedToday(s) { return !!s && (s.o === 'noanswer' || s.o === 'voicemail' || s.o === 'called') && ymd(new Date(s.at)) === today(); }
  function dueNow(s) { return s.o === 'callback' && s.due && (s.due < today() || (s.due === today() && (!s.dueAt || Date.now() >= s.dueAt))); }
  function rank(l) {
    var s = S.log[l.id];
    if (!s) return 2;
    if (CLOSED[s.o]) return 4;
    if (dueNow(s)) return 0;
    if (s.o === 'interested' || s.wasInterested) return 1;
    return 3;
  }
  /* within a rank: businesses you can call right now first, ones already tried today last */
  function sortedLeads() {
    return LEADS.slice().sort(function (x, y) {
      var sx = S.log[x.id], sy = S.log[y.id];
      return (rank(x) - rank(y)) || ((triedToday(sx) ? 1 : 0) - (triedToday(sy) ? 1 : 0)) ||
        ((localTime(x.st).ok ? 0 : 1) - (localTime(y.st).ok ? 0 : 1)) || String((sx || {}).due || '').localeCompare(String((sy || {}).due || ''));
    });
  }
  function counts() {
    var c = { due: 0, warm: 0, fresh: 0, again: 0, done: 0 };
    LEADS.forEach(function (l) { c[['due', 'warm', 'fresh', 'again', 'done'][rank(l)]]++; });
    c.toCall = c.due + c.warm + c.fresh + c.again; c.tried = LEADS.length - c.fresh; return c;
  }
  function todayStats() {
    var t = today(), s = { calls: 0, talked: 0, warm: 0 };
    S.calls.forEach(function (x) { if (ymd(new Date(x.at)) !== t) return; s.calls++; if (TALKED[x.o]) s.talked++; if (x.o === 'interested' || x.o === 'won') s.warm++; });
    return s;
  }
  function statusText(s) {
    var t = s.o === 'callback' && s.due ? (s.due < today() ? 'Call back: overdue since ' + dayLabel(s.due) : s.due === today() && s.dueAt && Date.now() < s.dueAt ? 'Call back after ' + new Date(s.dueAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : 'Call back ' + dayLabel(s.due)) : OUT[s.o];
    if ((s.o === 'noanswer' || s.o === 'voicemail') && s.tries > 1) t += ' · ' + s.tries + ' tries';
    return s.wasInterested && !CLOSED[s.o] ? 'Interested · ' + t : t;
  }
  function callsSummary(c) {
    var parts = [];
    if (c.due) parts.push(c.due + (c.due === 1 ? ' call-back' : ' call-backs') + ' due');
    if (c.warm) parts.push(c.warm + ' interested');
    if (c.fresh) parts.push(c.fresh + ' new');
    if (c.again) parts.push(c.again + ' to try again');
    return parts.join(', ');
  }

  /* ---------- sample money: two fictional clients (not in the lead list) ---------- */
  var BOOK = [
    { client: 'Juniper Lane Plumbing', on: 'Lineback', pays: 197, earned: true, state: 'Earned. Paid in the first payout after the tax form and payout account are set up.' },
    { client: 'Two Creeks Roofing', on: 'Frontdesk', pays: 397, earned: false, state: 'On hold: a new client’s first payment can be held up to 30 days after it clears.' }
  ];
  /* your own money: nothing is earned until a client's payment clears. PREVIEW has no payments; LIVE reads the engine's money lines */
  function totals() {
    var t = MONEY && MONEY.totals; if (DEMO) return { ready: 0, hold: 0, paid: 0 };
    if (!t) return { ready: 0, hold: 0, paid: 0, unknown: true }; // couldn't be read: never shown as $0
    return { ready: (t.ready_cents || 0) / 100, hold: (t.on_hold_cents || 0) / 100, paid: (t.paid_cents || 0) / 100 }; // waiting_cents is inside on_hold_cents already
  }
  function exampleTotals() {
    var ready = 0, hold = 0;
    BOOK.forEach(function (b) { var c = b.pays * PW.rate; if (b.earned) ready += c; else hold += c; });
    return { ready: ready, hold: hold };
  }

  /* ---------- entry check: the rules from the partner guide people trip on ---------- */
  var QUIZ = [
    { q: 'A business owner asks, “Can you do it cheaper?” What do you say?',
      a: [['I can’t change prices, they’re the same for everyone. Let’s make sure you’re on the right product.', 1], ['I’ll give you part of my commission.', 0], ['I can get you a special deal.', 0]],
      why: 'Station sets prices and they’re the same for everyone. Never offer part of your commission, a deal or a longer trial.' },
    { q: 'A client pays Station for a new website build. Do you earn 40% of the build fee?',
      a: [['Yes, 40% of everything they pay.', 0], ['No. You earn 40% of what they pay every month, never one-time fees.', 1]],
      why: 'Your 40% is on the monthly payments that clear. Website build fees earn nothing, but the monthly price behind them earns you every month.' },
    { q: 'Someone asks, “Do you work for Station?”',
      a: [['Yes, I’m on Station’s sales team.', 0], ['I’m an independent partner with Station, and I earn a commission if you sign up.', 1]],
      why: 'You’re an independent partner, not an employee. Saying so honestly is what makes people trust you.' },
    { q: 'A roofer wants the missed-call text-back working today. What do you tell them?',
      a: [['It’ll be live today.', 0], ['Anything that sends texts needs carrier registration first. It takes about 2 business days, and Station files it.', 1]],
      why: 'Never say “live today” for anything that texts. Calls and chat can go live the same day; texting waits on the carriers.' },
    { q: 'When are you allowed to call a business?',
      a: [['Any time I’m free.', 0], ['9 am to 8 pm, Monday to Saturday, in the business’s own time zone.', 1]],
      why: 'The call button only works during those hours, in their local time. Every lead card shows their time and whether it’s OK to call.' },
    { q: 'An owner says, “Take me off your list.” What do you do?',
      a: [['Say sorry, end the call, and mark them Do not call.', 1], ['Ask if they’re sure, then give the pitch one more time.', 0], ['Call back next week in case they change their mind.', 0]],
      why: 'When someone asks you to stop, stop. Do not call means nobody calls that business again.' }
  ];
  var HINT = ['Think about who sets the prices.', 'Think about which payments repeat every month.', 'Think about what’s true, and what makes people trust you.',
    'Think about what has to happen before anything can send texts.', 'Think about whose clock matters.', 'Think about what they asked you to do.'];

  /* ---------- LIVE: Station's partner engine ----------
     One endpoint, JSON in and out; a refusal is {ok:false, error:"<a sentence>"}. Sign-in reads me, leads_list and
     money_lines. Every write goes through ONE queue, sent one at a time: the engine saves its whole store when each call
     ends, so two writes in flight can roll each other back (engine note AE-3). A call result waits in the queue until
     its Undo has gone; anything that can't be sent stays queued in this browser and goes as soon as Station answers. */
  var ME = null, LL = null, MONEY = null, MONEY_ERR = '', BOOTED = false, BOOTING = false, BOOT_ERR = '', LOADED_AT = 0, SIGNIN_MSG = '', SIGNIN_GOOD = false, signMode = 'login';
  var FROM_ENGINE = { no_answer: 'noanswer', voicemail: 'voicemail', bad_lead: 'bad', interested: 'interested', callback: 'callback', not_interested: 'notint', dnc: 'dnc', won: 'won',
    called: 'called', demo_sent: 'interested' }; // the last two only come from the old portal's outcome list
  var NOTE_MAX = DEMO ? 200 : 1500; // the engine keeps notes up to 1,500 characters
  var TO_ENGINE = { noanswer: { result: 'no_answer' }, voicemail: { result: 'voicemail' }, bad: { result: 'bad_lead' },
    interested: { result: 'talked', outcome: 'interested' }, callback: { result: 'talked', outcome: 'callback' },
    notint: { result: 'talked', outcome: 'not_interested' }, dnc: { result: 'talked', outcome: 'dnc' }, won: { result: 'talked', outcome: 'won' } };
  function sentence(s, fallback) { s = String(s || '').trim(); if (!s) return fallback; s = s.charAt(0).toUpperCase() + s.slice(1); return /[.!?]$/.test(s) ? s : s + '.'; }
  /* ONE lane for every engine call, reads included: leads_list can write too (it archives expired rows), and the engine keeps
     whichever save lands last, so nothing overlaps -- not a resync with a send, not an upload with a send */
  var LANE = Promise.resolve();
  function api(action, body) {
    var run = function () { return send(action, body); };
    var p = LANE.then(run, run);
    LANE = p.then(function () {}, function () {});
    return p;
  }
  /* a call that never answers would block the one lane, so every call has a time limit; an HTTP error carries its status */
  function send(action, body) {
    var payload = Object.assign({ action: action }, body || {});
    if (action !== 'login' && action !== 'claim') { if (!TOKEN) return Promise.resolve({ ok: false, signedOut: true }); payload.token = TOKEN; } // signed out while it waited in the lane: keep it
    var ctl = window.AbortController ? new AbortController() : null, lim = action === 'taxform_submit' ? 90000 : /^(cc_call|cc_more|note_add|note_del|payout_link)$/.test(action) ? 30000 : 20000;
    var tm = ctl ? setTimeout(function () { ctl.abort(); }, lim) : 0;
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(tm); if (!r.ok) { var er = new Error('HTTP ' + r.status); er.http = r.status; throw er; } return r.json(); }, function (e) { clearTimeout(tm); throw e; })
      .then(function (d) {
        if (Array.isArray(d)) d = d[0] || {};
        d = d && typeof d === 'object' ? d : {};
        if (d.ok === false && /^(not signed in|sign in first)$/i.test(String(d.error || '')) && TOKEN) { d.signedOut = true; signedOut('Your sign-in has expired. Please sign in again.'); }
        return d;
      });
  }
  function dealtTotal() { return DEMO ? LEADS.length : (LL && LL.cc && LL.cc.counts && LL.cc.counts.station_total) || 0; }
  function batchWords() { var n = !DEMO && LL && LL.cc && +LL.cc.batch; return 'up to ' + (n || 50) + ' businesses'; }
  function holdDays() { return (!DEMO && LL && LL.cc && +LL.cc.station_days) || HOLD_DAYS; }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0].slice(0, 40); }

  /* an engine row -> the card the feed draws */
  function fromRow(r) {
    var d = String(r.phone || '').replace(/\D/g, ''); if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    var nice = d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : String(r.phone || '');
    var niche = String(r.niche || '').trim();
    return { id: String(r.id), name: r.name || 'A local business', trade: niche ? niche.charAt(0).toUpperCase() + niche.slice(1) : 'Local business',
      city: r.city || '', st: String(r.state || '').toUpperCase().slice(0, 2), rating: +r.rating || 0, reviews: +r.reviews || 0,
      gap: r.gap || 'Station picked this business for you.', fits: BOX[r.sku] ? r.sku : 'bundle-answer',
      phone: nice, dial: d.length === 10 ? '+1' + d : nice.replace(/[^\d+]/g, ''), until: +r.until || 0 };
  }
  /* the engine's record of a row -> this app's status for it; prev keeps what only this browser knows (the email typed, the hour of a "later today") */
  function logFromRow(r, prev) {
    var att = Array.isArray(r.attempts) ? r.attempts : [], last = att[att.length - 1];
    var o = FROM_ENGINE[r.outcome] || (last && FROM_ENGINE[last.result]) || '';
    if (!o) return null;
    prev = prev || {};
    var x = { o: o, at: Date.parse(r.outcome_at || (last && last.at) || '') || Date.now(), box: prev.box || (BOX[r.sku] ? r.sku : 'bundle-answer') };
    var tries = att.filter(function (a) { return a.result === 'no_answer' || a.result === 'voicemail'; }).length; if (tries) x.tries = tries;
    if (o === 'callback' && r.next_at) { x.due = String(r.next_at).slice(0, 10); if (prev.due === x.due && prev.dueAt) x.dueAt = prev.dueAt; }
    if (prev.email) x.email = prev.email;
    if (prev.wasInterested && !CLOSED[o] && o !== 'interested') x.wasInterested = true;
    if (o === 'won' && r.won && r.won.accepted_at) x.accepted = true;
    return x;
  }
  function liveRow(r, now) { return r && r.source === 'station' && !r.archived && (+r.until || 0) > now; }
  function applyLeads(d) {
    LL = d;
    var now = Date.now(), rows = (d.leads || []).filter(function (r) { return liveRow(r, now); });
    LEADS = rows.map(fromRow); indexLeads();
    var log = {}, calls = [], notes = {};
    rows.forEach(function (r) {
      var id = String(r.id);
      if (queuedCall(id, true)) { if (S.log[id]) log[id] = S.log[id]; } // a result still on its way wins over the engine's older copy
      else { var x = logFromRow(r, S.log[id]); if (x) log[id] = x; }
      var att = Array.isArray(r.attempts) ? r.attempts : [], lastTalk = -1;
      att.forEach(function (a, i) { if (a.result === 'talked') lastTalk = i; });
      att.forEach(function (a, i) {
        var o = FROM_ENGINE[a.result] || (i === lastTalk ? FROM_ENGINE[r.outcome] || 'talked' : 'talked');
        calls.push({ id: id, o: o, at: Date.parse(a.at) || 0 });
      });
    });
    S.outbox.forEach(function (it) { if (it.k === 'call' && !it.change && LEAD[it.id]) calls.push({ id: it.id, o: it.o, at: it.at }); });
    var idx = d.notes || {};
    LEADS.forEach(function (l) {
      if (queuedNote(l.id)) { if (S.notes[l.id]) notes[l.id] = S.notes[l.id]; return; }
      var n = idx['lead:' + l.id]; if (n && n[0] && n[0].text) notes[l.id] = String(n[0].text).slice(0, NOTE_MAX);
    });
    S.log = log; S.notes = notes; S.calls = calls.sort(function (a, b) { return a.at - b.at; }).slice(-500);
    var cc = d.cc || {};
    S.asked = !!(cc.more_at && String(cc.more_at) > String(cc.last_deal_at || ''));
    S.askedAt = S.asked ? (Date.parse(cc.more_at) || 0) : 0;
    Object.keys(S.pitch).forEach(function (k) { if (!LEAD[k]) delete S.pitch[k]; });
    save();
  }

  /* ---------- the send queue ---------- */
  var QSEQ = 0, pumping = false, retryT = 0, noteT = {}, noteAgain = {};
  function newQ() { return Date.now().toString(36) + '-' + (++QSEQ); }
  function queuedCall(id, any) { var m = S.outbox.filter(function (x) { return x.k === 'call' && x.id === id && (any || !x.sending); }); return m[m.length - 1] || null; } // the newest
  function queuedNote(id) { return S.outbox.some(function (x) { return (x.k === 'note' || x.k === 'notedel') && x.id === id; }) || !!noteT[id]; }
  function queueCall(l, o, extra, changing) {
    var map = TO_ENGINE[o]; if (!map) return null;
    var waiting = changing ? queuedCall(l.id) : null, body = { id: l.id }; // only a correction merges; a new call is its own result
    // a correction to a result still waiting here replaces it; a correction to one Station already has (or to a waiting
    // correction) sends only the new outcome, so the engine never logs a conversation twice
    if (changing && (!waiting || waiting.change) && map.outcome) body.outcome = map.outcome; else Object.assign(body, map);
    if (o === 'callback' && extra && extra.due) body.next_at = extra.due;
    var note = String(S.notes[l.id] || '').replace(/\s+/g, ' ').trim(); if (note) body.note = note.slice(0, 200); // the engine keeps 200 with a call
    if (body.next_at && body.next_at < chicagoToday()) body.next_at = chicagoToday();
    if (waiting) {
      waiting.prev = { body: waiting.body, o: waiting.o, change: waiting.change, hold: waiting.hold, prev: waiting.prev }; // Undo goes back one step
      waiting.body = body; waiting.o = o; waiting.hold = true; save(); syncLine(); return waiting.q;
    }
    var it = { q: newQ(), k: 'call', id: l.id, o: o, body: body, hold: true, at: Date.now(), tries: 0, change: !!changing, code: S.code };
    S.outbox.push(it); save(); syncLine(); return it.q;
  }
  function findQ(q) { return S.outbox.filter(function (x) { return x.q === q; })[0] || null; }
  function release(q) { var it = findQ(q); if (!it) return; it.hold = false; delete it.prev; save(); pump(); }
  function dropQueued(q) {
    var it = findQ(q); if (!it || it.sending) return;
    if (it.prev) { var pv = it.prev; it.body = pv.body; it.o = pv.o; it.change = pv.change; it.hold = false; if (pv.prev) it.prev = pv.prev; else delete it.prev; } // undoing a correction leaves the result before it to send
    else S.outbox = S.outbox.filter(function (x) { return x !== it; });
    save(); pump();
  }
  function noteChanged(id) {
    if (DEMO) return;
    clearTimeout(noteT[id]);
    noteT[id] = true; // edited here, not yet saved: it saves when the partner leaves the box (change), the sheet closes, or the app is hidden
  }
  function noteDone(id) { if (DEMO || !noteT[id]) return; delete noteT[id]; queueNote(id); }
  function chicagoToday() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()); } catch (e) { return today(); } }
  function serverNotes(id) { return (LL && LL.notes && LL.notes['lead:' + id]) || []; }
  /* Station keeps notes as a history (the old portal shows the journal). The box here edits the newest one: an edit adds a
     note and removes the one it replaces ONLY if Partner World wrote that one; notes from the old portal are never deleted. */
  function mine() { if (!S.mine || typeof S.mine !== 'object') S.mine = {}; return S.mine; }
  function queueNote(id) {
    if (S.outbox.some(function (x) { return (x.k === 'note' || x.k === 'notedel') && x.id === id && x.sending; })) { noteAgain[id] = true; return; } // decide after Station answers
    var text = String(S.notes[id] || '').trim().slice(0, NOTE_MAX), have = serverNotes(id), top = have[0], ours = !!(top && mine()[top.id]);
    S.outbox = S.outbox.filter(function (x) { return !(x.k === 'note' && x.id === id && !x.sending); });
    if (text === String((top && top.text) || '').trim()) { save(); syncLine(); return; } // the newest note is the one shown; unchanged isn't sent again
    if (text) S.outbox.push({ q: newQ(), k: 'note', id: id, body: { subject: 'lead:' + id, text: text }, replaces: ours ? top.id : '', at: Date.now(), tries: 0, code: S.code });
    else if (ours) S.outbox.push({ q: newQ(), k: 'notedel', id: id, body: { id: top.id }, at: Date.now(), tries: 0, code: S.code });
    else if (top) { S.notes[id] = String(top.text || '').slice(0, NOTE_MAX); toast('That note was written in the old portal, so it stays. Type a new one to replace it here.', 5000); var c = cardEl(id); if (c && !c.contains(document.activeElement)) renderCard(c); }
    save(); pump();
  }
  function flushNotes() { Object.keys(noteT).forEach(function (id) { delete noteT[id]; queueNote(id); }); }
  function pump() {
    if (DEMO || !TOKEN || pumping || BOOTING) { syncLine(); return; }
    var it = S.outbox.filter(function (x) { return !x.hold; })[0];
    if (!it) { syncLine(); return; }
    pumping = true; it.sending = true; syncLine();
    var action = { call: 'cc_call', note: 'note_add', notedel: 'note_del' }[it.k];
    api(action, it.body).then(function (d) {
      pumping = false; it.sending = false;
      if (d.signedOut || !TOKEN) { save(); return; } // kept: it goes after the next sign-in
      S.outbox = S.outbox.filter(function (x) { return x !== it; }); save();
      if (d.ok === false) refused(it, d.error); else landed(it, d);
      if ((it.k === 'note' || it.k === 'notedel') && noteAgain[it.id]) { delete noteAgain[it.id]; queueNote(it.id); } // an edit made while this one was sending
      pump();
    }, function (e) {
      pumping = false; it.sending = false;
      // Station's system answered with an error: it may have saved, so don't send it twice. Say so and show Station's copy.
      if ((it.k === 'note' || it.k === 'notedel') && noteAgain[it.id]) { delete noteAgain[it.id]; noteT[it.id] = true; }
      if (e && e.http && [502, 503, 504].indexOf(e.http) < 0) {
        S.outbox = S.outbox.filter(function (x) { return x !== it; }); save();
        toast((it.k === 'call' && LEAD[it.id] ? LEAD[it.id].name + ': ' : '') + 'Station’s system had a problem saving that, so it may not have saved. Your list is refreshing.', 7000);
        resync(true); pump(); return;
      }
      it.tries = (it.tries || 0) + 1; save(); syncLine();
      clearTimeout(retryT); retryT = setTimeout(pump, Math.min(60000, 2000 * Math.pow(2, Math.min(it.tries, 5))));
    });
  }
  function landed(it, d) {
    if (it.k === 'call' && d.lead && LL) {
      var r = d.lead, list = LL.leads || [];
      for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(r.id)) { list[i] = r; break; }
      if (LEAD[r.id]) LEAD[r.id].until = +r.until || LEAD[r.id].until;
      if (S.log[r.id] && r.won && r.won.accepted_at) S.log[r.id].accepted = true;
      // Do not call / Bad lead are locked once Station has them: redraw so the card stops offering Change
      var s = S.log[r.id], c = cardEl(r.id);
      if (s && (s.o === 'dnc' || s.o === 'bad') && c && !queuedCall(r.id, true) && !c.contains(document.activeElement)) renderCard(c);
    } else if ((it.k === 'note' || it.k === 'notedel') && LL && Array.isArray(d.notes)) {
      if (!LL.notes) LL.notes = {}; LL.notes['lead:' + it.id] = d.notes;
      if (it.k === 'note' && d.note && d.note.id) {
        mine()[d.note.id] = 1;
        if (it.replaces) S.outbox.push({ q: newQ(), k: 'notedel', id: it.id, body: { id: it.replaces }, at: Date.now(), tries: 0, code: S.code });
      }
      if (it.k === 'notedel') delete mine()[it.body.id];
      save();
    }
  }
  /* Station said no (the lead was taken back, a Do not call can't change, a date is in the past...): say why, then show Station's copy */
  function refused(it, err) {
    var what = it.k === 'call' ? (LEAD[it.id] ? LEAD[it.id].name + ': ' : '') : 'Note not saved: ';
    toast(what + sentence(err, 'Station couldn’t save that.'), 6000);
    resync(true);
  }
  function syncLine() {
    if (DEMO) return;
    var waiting = S.outbox.filter(function (x) { return !x.hold; }), stuck = waiting.filter(function (x) { return x.tries > 0; });
    if (!stuck.length) { banner.hidden = true; banner.classList.remove('warn'); return; }
    var n = waiting.length;
    banner.hidden = false; banner.classList.add('warn');
    banner.innerHTML = n + (n === 1 ? ' save hasn’t' : ' saves haven’t') + ' reached Station yet. ' + (TOKEN ? 'They send by themselves while this page is open, as soon as Station answers.' : 'They send after you sign in.') +
      (TOKEN ? ' <button class="link-btn" type="button" id="retryNow">Try now</button>' : '');
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#retryNow')) { clearTimeout(retryT); S.outbox.forEach(function (x) { x.tries = 0; }); pump(); } });
  window.addEventListener('online', function () { clearTimeout(retryT); pump(); });
  document.addEventListener('visibilitychange', function () {
    if (DEMO) return;
    if (document.visibilityState === 'hidden') { flushNotes(); if (U && U.qid) hideUndo(); pump(); return; } // they left (often for the dialer): the Undo goes and the result is sent
    pump();
    if (BOOTED && Date.now() - LOADED_AT > 120000) resync(false);
  });
  window.addEventListener('pagehide', function () { if (!DEMO) flushNotes(); });

  /* reload Station's copy; redraw only when nobody is in the middle of something */
  var resyncing = false;
  function busy() {
    var a = document.activeElement;
    return !sheet.hidden || !!TOUR || !!U || !!pending || (a && /input|textarea|select/i.test(a.tagName));
  }
  var redrawT = 0;
  function redrawWhenFree(view) {
    clearInterval(redrawT);
    redrawT = setInterval(function () {
      var now = (location.hash || '').replace(/^#/, '').split('/')[0] || 'home';
      if (now !== view) { clearInterval(redrawT); return; }
      if (!busy()) { clearInterval(redrawT); route(); }
    }, 2000);
  }
  function resync(force) {
    if (DEMO || !TOKEN || resyncing) return;
    resyncing = true;
    var before = LEADS.map(function (l) { return l.id + ':' + ((S.log[l.id] || {}).o || ''); }).join('|');
    api('leads_list').then(function (d) {
      resyncing = false;
      if (d.ok === false) return;
      applyLeads(d); LOADED_AT = Date.now();
      var after = LEADS.map(function (l) { return l.id + ':' + ((S.log[l.id] || {}).o || ''); }).join('|');
      if (after === before && !force) return;
      var view = (location.hash || '').replace(/^#/, '').split('/')[0] || 'home';
      // never redraw over a partner mid-task: a sheet, the tour, an Undo, a call, typing. A forced redraw waits for them.
      if (busy() || (view === 'calls' && !force && (feedEl() && feedEl().scrollTop > 10))) { if (view === 'calls') updateEnd(); if (force) redrawWhenFree(view); return; }
      if (view === 'home' || view === 'calls' || view === 'money') route();
    }, function () { resyncing = false; });
    if (location.hash === '#money') api('money_lines').then(function (x) { if (x && x.ok !== false) MONEY = x; }, function () {});
  }

  /* ---------- sign in, load, sign out ---------- */
  /* wipe = the partner chose to sign out: nothing of theirs stays in this browser (a shared computer). An expired sign-in keeps
     the unsent queue for the same partner's next sign-in (boot drops it for anyone else). */
  function forgetPartner() { S.outbox = []; S.entered = false; S.toured = false; S.pitch = {}; S.mine = {}; S.focus = ''; S.log = {}; S.notes = {}; S.calls = []; noteT = {}; noteAgain = {}; }
  function signedOut(msg, wipe) {
    TOKEN = ''; try { localStorage.removeItem(TKEY); } catch (e) {}
    BOOTED = false; ME = null; LL = null; MONEY = null; LEADS = []; indexLeads(); S.log = {}; S.notes = {}; S.calls = [];
    if (wipe) { forgetPartner(); S.name = ''; S.code = ''; }
    save();
    SIGNIN_MSG = msg || ''; signMode = 'login';
    if (!sheet.hidden) hideSheet();
    hideUndo(); route();
  }
  function showLoading() {
    chrome(false);
    mount('<section class="enter"><div class="enter-card"><div class="enter-top">' + MARK + '</div><h1>Loading your businesses…</h1><p class="intro">Getting your list from Station.</p></div></section>', 'Loading');
  }
  function boot() {
    BOOTING = true; BOOT_ERR = ''; showLoading();
    return api('me').then(function (m) {
      if (m.signedOut) throw 'out';
      if (m.ok === false) throw sentence(m.error, 'Station couldn’t load your account.');
      if (m.code && S.code && m.code !== S.code) forgetPartner(); // someone else used this browser before: their check, picks and notes aren't this partner's
      ME = m; S.code = m.code || S.code; S.name = firstName(m.name) || S.name || 'there';
      S.outbox = S.outbox.filter(function (x) { return !x.code || x.code === S.code; });
      S.outbox.forEach(function (x) { x.hold = false; x.sending = false; delete x.prev; });
      return api('leads_list');
    }).then(function (d) {
      if (d.signedOut) throw 'out';
      if (d.ok === false) throw sentence(d.error, 'Station couldn’t load your businesses.');
      applyLeads(d);
      return api('money_lines').then(function (x) { MONEY = x && x.ok !== false ? x : null; MONEY_ERR = x && x.ok === false ? sentence(x.error, '') : ''; },
        function () { MONEY = null; MONEY_ERR = 'Your money couldn’t load just now.'; });
    }).then(function () { BOOTING = false; BOOTED = true; LOADED_AT = Date.now(); save(); pump(); },
      function (e) { BOOTING = false; if (e === 'out') return; BOOT_ERR = typeof e === 'string' ? e : e && e.http ? 'Station’s system had a problem (error ' + e.http + '). It’s not your connection. Try again in a minute.' : 'No connection to Station. Check your internet and try again.'; });
  }
  function startLive() {
    boot().then(function () {
      if (!TOKEN) return; route();
      if (savedCall && LEAD[savedCall.id] && Date.now() - savedCall.at < 30 * 60e3 && location.hash.indexOf('#calls') === 0) openCallSheet(LEAD[savedCall.id], 'during');
    });
  }
  function renderBootError() {
    chrome(false);
    mount('<section class="enter"><div class="enter-card"><div class="enter-top">' + MARK + '</div><h1>Station didn’t answer</h1>' +
      '<p class="intro">' + esc(BOOT_ERR || 'No connection to Station. Check your internet and try again.') + '</p>' +
      '<button class="btn btn-dark btn-big btn-block" type="button" id="bootRetry">Try again</button>' +
      '<p class="small center"><button class="link-btn" type="button" id="bootOut">Sign out</button></p></div></section>', 'Not loaded');
    document.getElementById('bootRetry').addEventListener('click', startLive);
    document.getElementById('bootOut').addEventListener('click', function () { var done = function () { signedOut('You’re signed out.', true); }; api('logout').then(done, done); });
  }
  function renderSignIn() {
    chrome(false);
    var claim = signMode === 'claim';
    mount('<section class="enter"><div class="enter-card">' +
      '<div class="enter-top">' + MARK + '<button class="size-inline" type="button" data-size aria-pressed="' + !!S.big + '"><span aria-hidden="true">Aa</span> Bigger text</button></div>' +
      '<h1>' + (claim ? 'Set your password' : 'Sign in to Station Partner World') + '</h1>' +
      '<p class="intro">' + (claim ? 'First time here? Use the partner code and the email from your invite, then choose a password of 10 or more characters.'
        : 'Call local businesses Station gives you. When one signs up, you earn 40% of the monthly fees they pay Station, for as long as they keep paying.') + '</p>' +
      (SIGNIN_MSG ? '<div class="explain ' + (SIGNIN_GOOD ? 'good' : 'bad') + '" role="status">' + esc(SIGNIN_MSG) + '</div>' : '') +
      '<form id="signin" novalidate>' +
      (claim ? '<label class="field" for="s-code">Your partner code<span class="hint">It’s in your invite email, something like jsmith.</span><input class="text" id="s-code" autocomplete="off" autocapitalize="none" spellcheck="false"></label>' : '') +
      '<label class="field" for="s-email">Email<input class="text" id="s-email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false"></label>' +
      '<label class="field" for="s-pw">' + (claim ? 'Choose a password' : 'Password') + (claim ? '<span class="hint">10 or more characters. A short sentence is easiest to remember.</span>' : '') +
      '<input class="text" id="s-pw" type="password" autocomplete="' + (claim ? 'new-password' : 'current-password') + '"></label>' +
      '<p class="field-err" id="e-form" role="alert"></p>' +
      '<button class="btn btn-dark btn-big btn-block" type="submit" id="s-go">' + (claim ? 'Set my password' : 'Sign in') + '</button></form>' +
      '<p class="small center"><button class="link-btn" type="button" id="swapMode">' + (claim ? 'Already set your password? Sign in' : 'First time here? Activate your invite (set a password)') + '</button></p>' +
      '<p class="small center">Forgot your password? Email <a href="mailto:main@station.solutions">main@station.solutions</a>. Once Station resets it, use “First time here?” to set a new one.</p>' +
      '<p class="small center">You stay signed in on this device for 30 days. On a shared computer, sign out in Help when you’re done.</p>' +
      '<p class="small center"><a href="?preview">Just looking? Open the preview with sample businesses</a></p>' +
      '<p class="trust">Same account as the Station partner portal. No quota, no tiers, no bonuses: just the flat 40%. Station is Station Automations Group LLC, in Houston, Texas. The Station Partner Agreement wins over anything in this app.</p>' +
      '</div></section>', claim ? 'Set your password' : 'Sign in');
    document.getElementById('swapMode').addEventListener('click', function () { signMode = claim ? 'login' : 'claim'; SIGNIN_MSG = ''; SIGNIN_GOOD = false; renderSignIn(); });
    var first = document.getElementById(claim ? 's-code' : 's-email'); if (first) first.focus({ preventScroll: true });
    var form = document.getElementById('signin'), go = document.getElementById('s-go'), ef = document.getElementById('e-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('s-email').value.trim().toLowerCase(), pw = document.getElementById('s-pw').value;
      var codeIn = document.getElementById('s-code'), c = codeIn ? codeIn.value.trim().toLowerCase() : '';
      function bad(el, msg) { ef.textContent = msg; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } }
      form.querySelectorAll('[aria-invalid]').forEach(function (x) { x.removeAttribute('aria-invalid'); });
      if (claim && !c) { bad(codeIn, 'Please add the partner code from your invite email.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { bad(document.getElementById('s-email'), 'Please add the email your invite went to.'); return; }
      if (!pw) { bad(document.getElementById('s-pw'), 'Please add your password.'); return; }
      if (claim && pw.length < 10) { bad(document.getElementById('s-pw'), 'Your password needs 10 or more characters.'); return; }
      go.disabled = true; go.textContent = claim ? 'Saving…' : 'Signing in…'; ef.textContent = '';
      api(claim ? 'claim' : 'login', claim ? { code: c, email: email, password: pw } : { email: email, password: pw }).then(function (d) {
        if (d.ok && d.token) {
          TOKEN = d.token; try { localStorage.setItem(TKEY, TOKEN); } catch (er) {}
          var a = d.affiliate || {}; if (a.code && S.code && a.code !== S.code) forgetPartner(); S.code = a.code || S.code; S.name = firstName(a.name) || S.name; SIGNIN_MSG = ''; save();
          boot().then(function () { if (!TOKEN) return; history.replaceState(null, '', location.pathname + (S.entered ? '#home' : '#check')); route(); });
          return;
        }
        go.disabled = false; go.textContent = claim ? 'Set my password' : 'Sign in';
        if (d.status && d.status !== 'active' && /saved|approved/i.test(String(d.error || ''))) { // a pending account: the password IS saved
          signMode = 'login'; SIGNIN_GOOD = true; SIGNIN_MSG = 'Your password is saved. Station still has to approve your account; you’ll get an email when it’s ready, then sign in here.'; renderSignIn(); return;
        }
        bad(null, friendly(d.error));
      }, function () {
        go.disabled = false; go.textContent = claim ? 'Set my password' : 'Sign in';
        bad(null, 'No connection to Station. Check your internet and try again.');
      });
    });
  }
  function friendly(err) {
    var e = String(err || '').toLowerCase();
    if (/code and email do not match/.test(e)) return 'That partner code and email don’t go together. Check your invite email, or email main@station.solutions.';
    if (/password already set/.test(e)) return 'You’ve already set a password. Sign in instead, or email main@station.solutions to reset it.';
    if (/unknown code/.test(e)) return 'Station doesn’t know that partner code. Check your invite email.';
    return sentence(err, 'That didn’t work. Check your email and password.');
  }
  function askForMore(btn) {
    hideUndo(); flushNotes();
    if (S.outbox.length) { // the engine counts what it has: the last results must land first
      btn.disabled = true; btn.textContent = 'Sending your last results…'; pump();
      var t0 = Date.now(), iv = setInterval(function () {
        if (!S.outbox.length) { clearInterval(iv); btn.disabled = false; btn.textContent = 'Ask for my next batch'; askForMore(btn); }
        else if (Date.now() - t0 > 15000) { clearInterval(iv); btn.disabled = false; btn.textContent = 'Ask for my next batch'; toast('Some results haven’t reached Station yet. Try again in a moment.', 5000); }
      }, 300);
      return;
    }
    btn.disabled = true; btn.textContent = 'Asking Station…';
    api('cc_more', {}).then(function (d) {
      if (d.signedOut) return;
      if (d.ok === false) { btn.disabled = false; btn.textContent = 'Ask for my next batch'; toast(sentence(d.error, 'Station couldn’t take that just now.'), 6000); return; }
      S.asked = true; S.askedAt = Date.parse(d.more_at) || Date.now(); if (LL && LL.cc) LL.cc.more_at = d.more_at; save();
      updateEnd(); var e2 = document.querySelector('#endCard .lead-card'); if (e2 && !reduced) e2.classList.add('pop');
      toast('Asked. Station will send your next batch.');
    }, function () { btn.disabled = false; btn.textContent = 'Ask for my next batch'; toast('No connection to Station. Try again in a moment.', 5000); });
  }

  /* ---------- router ---------- */
  var VIEWS = {}, tick = null;
  var firstRoute = true;
  function route() {
    clearInterval(tick); tick = null; hideUndo(); endTour(); setPending(null);
    if (!(toast.keep > Date.now())) document.getElementById('toast').classList.remove('on'); // a refusal or warning outlives a redraw
    if (!sheet.hidden) { sheet.hidden = true; }
    var parts = (location.hash || '').replace(/^#/, '').split('/');
    function draw() {
      if (parts[0] === 'admin') { if (DEMO) VIEWS.admin(); else location.replace('#home'); return; } // the sample founder view is preview-only; the real one is in Circle
      if (!DEMO) {
        if (!TOKEN) { renderSignIn(); return; }
        if (BOOTING) { showLoading(); return; }
        if (!BOOTED) { renderBootError(); return; }
        if (!S.entered && parts[0] !== 'check') { VIEWS.check(); return; }
      }
      if (!S.entered && parts[0] !== 'check') { renderWelcome(); return; }
      if (parts[0] === 'check' && !S.name) { renderWelcome(); return; }
      (VIEWS[parts[0]] || VIEWS.home)(parts[1]);
    }
    if (firstRoute || reduced || !document.startViewTransition) { firstRoute = false; draw(); return; }
    document.startViewTransition(draw);
  }
  function chrome(on, tab) {
    document.getElementById('bar').hidden = !on; document.getElementById('tabbar').hidden = !on;
    document.body.classList.toggle('has-tabs', on);
    document.body.classList.toggle('calls-mode', tab === 'calls');
    document.body.classList.toggle('admin-mode', tab === 'admin');
    document.documentElement.classList.toggle('calls-lock', tab === 'calls'); // only the feed scrolls on Calls, never the page
    document.querySelectorAll('[data-tab]').forEach(function (a) { var here = a.getAttribute('data-tab') === tab; a.classList.toggle('on', here); if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var tt = totals(); document.getElementById('chipBal').textContent = tt.unknown ? '—' : money(tt.ready);
  }
  function mount(html, title) {
    main.innerHTML = html; window.scrollTo(0, 0);
    document.title = title ? title + ' · Station Partner World' : 'Station Partner World';
    var h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ---------- welcome ---------- */
  function renderWelcome() {
    chrome(false);
    mount('<section class="enter"><div class="enter-card">' +
      '<div class="enter-top">' + MARK + '<button class="size-inline" type="button" data-size aria-pressed="' + !!S.big + '"><span aria-hidden="true">Aa</span> Bigger text</button></div>' +
      '<h1>Welcome to Station Partner World</h1>' +
      '<p class="intro">Call local businesses Station gives you. When one signs up, you earn 40% of what they pay Station, every month they keep paying.</p>' +
      '<ol class="steps3"><li><b>1</b><span><strong>Learn one product.</strong> Lineback is the easiest; its cheat sheet takes 2 minutes.</span></li>' +
      '<li><b>2</b><span><strong>Call your list.</strong> The words to say are on every card.</span></li>' +
      '<li><b>3</b><span><strong>Get paid.</strong> 40% of every monthly payment your clients make.</span></li></ol>' +
      '<form id="hello" novalidate>' +
      '<label class="field" for="w-name">Your first name<input class="text" id="w-name" autocomplete="given-name" aria-describedby="e-name" value="' + esc(S.name) + '"></label><p class="field-err" id="e-name" role="alert"></p>' +
      '<label class="field" for="w-code">Your partner code<span class="hint">It’s in your invite email, something like jsmith. Can’t find it? Email main@station.solutions.</span><input class="text" id="w-code" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="e-code w-codeuse" value="' + esc(S.code) + '"></label>' +
      '<p class="hint" id="w-codeuse"></p><p class="field-err" id="e-code" role="alert"></p>' +
      '<p class="small" style="margin:0 0 16px">Next: a 1-minute check, six questions on the rules that matter most.</p>' +
      '<button class="btn btn-dark btn-big btn-block" type="submit">Start the 1-minute check</button></form>' +
      '<p class="trust">No quota, no tiers, no bonuses: just the flat 40%. Station is Station Automations Group LLC, in Houston, Texas. Before your first real call you’ll sign the Station Partner Agreement, and it wins over anything in this app.</p>' +
      '</div></section>', 'Welcome');
    var nameIn = document.getElementById('w-name'), codeIn = document.getElementById('w-code'), use = document.getElementById('w-codeuse');
    function codeState() {
      var raw = codeIn.value.trim().toLowerCase();
      var ok = /^[a-z0-9-]{2,30}$/.test(raw);
      use.textContent = ok ? 'Your links will use ' + raw + '. Station checks it when you sign in.' : '';
      return { raw: raw, ok: ok };
    }
    function err(input, id, msg) { document.getElementById(id).textContent = msg; input.setAttribute('aria-invalid', 'true'); input.focus(); }
    codeIn.addEventListener('input', function () { codeState(); document.getElementById('e-code').textContent = ''; codeIn.removeAttribute('aria-invalid'); });
    nameIn.addEventListener('input', function () { document.getElementById('e-name').textContent = ''; nameIn.removeAttribute('aria-invalid'); });
    codeState();
    document.getElementById('hello').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = nameIn.value.trim(), c = codeState();
      if (!n) { err(nameIn, 'e-name', 'Please add your first name.'); return; }
      if (!c.raw) { err(codeIn, 'e-code', 'Please add the partner code from your invite email.'); return; }
      if (!c.ok) { err(codeIn, 'e-code', 'A partner code is only letters, numbers and dashes, with no spaces, like jsmith. Check your invite email.'); return; }
      S.name = n.slice(0, 40); S.code = c.raw; save();
      if (location.hash === '#check') route(); else location.hash = '#check';
    });
  }

  /* ---------- the check (answers shuffle on every try, and a wrong pick never reveals the right one) ---------- */
  function shuffle(n) { var a = []; for (var k = 0; k < n; k++) a.push(k); for (var j = n - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)), t = a[j]; a[j] = a[r]; a[r] = t; } return a; }
  VIEWS.check = function () {
    var retake = S.entered;
    chrome(retake, 'help');
    var i = 0, order = null;
    function draw(picked) {
      var q = QUIZ[i]; if (!order) order = shuffle(q.a.length);
      var prog = QUIZ.map(function (_, k) { return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('');
      var ok = picked != null && q.a[picked][1] === 1;
      var body = '<section class="enter"><div class="enter-card"><div class="qprog" aria-hidden="true">' + prog + '</div>' +
        '<p class="small" style="margin:0 0 6px">Question ' + (i + 1) + ' of ' + QUIZ.length + '</p><h1 class="qh">' + esc(q.q) + '</h1><div class="choices" role="group" aria-label="Answers">';
      order.forEach(function (k) {
        var cls = picked == null || k !== picked ? '' : (ok ? ' right' : ' wrong');
        var mark = picked === k ? '<span class="your">' + (ok ? '✓ Your answer' : '✗ Your answer') + '</span>' : '';
        body += '<button class="choice' + cls + '" type="button" data-k="' + k + '"' + (picked != null ? ' disabled' : '') + '>' + mark + esc(q.a[k][0]) + '</button>';
      });
      body += '</div>';
      if (picked != null) {
        body += '<div class="explain ' + (ok ? 'good' : 'bad') + '" id="qExplain"><strong>' + (ok ? 'Right. ' : 'Not quite. ') + '</strong>' + esc(ok ? q.why : HINT[i]) + '</div>' +
          (ok ? '<button class="btn btn-dark btn-big btn-block" id="qNext" type="button" aria-describedby="qExplain">' + (i === QUIZ.length - 1 ? (retake ? 'Done' : 'Enter Station Partner World') : 'Next question') + '</button>'
              : '<button class="btn btn-big btn-block" id="qRetry" type="button" aria-describedby="qExplain">Try that one again</button>');
      }
      body += '</div></section>';
      mount(body, 'Quick check');
      main.querySelectorAll('.choice').forEach(function (b) { b.addEventListener('click', function () { draw(+b.getAttribute('data-k')); }); });
      var nx = document.getElementById('qNext'), rt = document.getElementById('qRetry');
      if (nx) { nx.focus(); nx.addEventListener('click', function () { if (i === QUIZ.length - 1) { S.entered = true; save(); location.hash = retake ? '#help' : '#home'; toast(retake ? 'Check passed.' : 'You’re in.'); } else { i++; order = null; draw(null); } }); }
      if (rt) { rt.focus(); rt.addEventListener('click', function () { draw(null); }); }
    }
    draw(null);
  };

  /* ---------- home: one clear next step ---------- */
  function closedNote(n) {
    if (n.unknown) return 'Check their local time before you call. Calls are 9 am to 8 pm, Monday to Saturday, their time.';
    if (n.ok) return '';
    if (n.sun) return 'Calls are closed on Sundays. They open Monday at 9 am, their time.';
    if (n.early) return 'It’s too early to call. Calls open at 9 am, their time.';
    return 'It’s too late to call. Calls open ' + n.opens + ', their time.';
  }
  function openerOf(b) { return (b.call && b.call.opener) || b.ask; }
  /* what you can actually do today: tried-today businesses come back tomorrow */
  function todayLine(c) {
    var later = LEADS.filter(function (l) { return rank(l) < 4 && triedToday(S.log[l.id]); }).length, now = c.toCall - later;
    return now + ' to call today' + (later ? ' · ' + later + ' tomorrow' : '');
  }
  function askedText() {
    if (!S.askedAt) return '';
    var d = new Date(S.askedAt), t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    return ymd(d) === today() ? 'at ' + t : dayLabel(ymd(d)) + ' at ' + t;
  }
  VIEWS.home = function () {
    chrome(true, 'home');
    var t = totals(), c = counts(), next = sortedLeads().filter(function (l) { return rank(l) < 4; })[0], st = todayStats();
    var where = next ? next.st : LEADS.length ? LEADS[0].st : 'TX', now = localTime(where);
    var nextHtml;
    if (!DEMO && !LEADS.length && !dealtTotal()) {
      nextHtml = '<section class="next-call" aria-labelledby="nextH"><span class="lbl">Your list</span><h2 id="nextH">Station hasn’t sent you businesses yet.</h2>' +
        '<p class="pitch-line">When it does, they show up here and in Calls, with the words to say on every card. Until then, learn one product: it takes 2 minutes.</p>' +
        '<div class="next-go"><a class="btn btn-dark btn-big" id="callGo" href="#box/bundle-answer">Learn the Answer collection</a></div></section>';
    } else if (next) {
      var nb = pitchFor(next), due = rank(next) === 0;
      nextHtml = '<section class="next-call" aria-labelledby="nextH"><span class="lbl">' + (due ? 'Call-back due' : 'Your next call') + '</span>' +
        '<h2 id="nextH">' + esc(next.name) + '</h2><p class="facts"><span>' + esc(next.trade) + ' · ' + esc(placeOf(next)) + '</span>' + (next.rating ? '<span>★ ' + next.rating + '</span>' : '') + '</p>' +
        '<p class="pitch-line">Pitch <strong>' + esc(nb.name) + '</strong>' + (S.pitch[next.id] ? ' (your pick)' : sellable(BOX[S.focus]) && S.focusDay === today() && nb.id === S.focus ? ' (your pick for today)' : '') + '. Say who you are, then open with: “' + esc(openerOf(nb)) + '”</p>' +
        '<p class="small' + (now.ok ? '' : ' closed-note') + '" id="callNote"' + (now.ok ? ' hidden' : '') + '>' + closedNote(now) + '</p>' +
        '<div class="next-go"><a class="btn btn-dark btn-big" id="callGo" href="#calls">' + (now.ok ? 'Start calling' : 'See my list') + '</a><span class="small">' + todayLine(c) + '</span></div>' +
        (S.asked ? '<p class="asked-line">Next batch: waiting for Station’s OK (asked ' + askedText() + ').</p>' : '') + '</section>';
    } else if (S.asked) {
      nextHtml = '<section class="next-call" aria-labelledby="nextH"><span class="lbl">Your list</span><h2 id="nextH">Waiting for Station’s OK</h2>' +
        '<p class="pitch-line">You asked for your next batch ' + askedText() + '. Station reviews every request, then your new businesses show up in Calls.</p><div class="next-go"><a class="btn btn-big" id="callGo" href="#calls">Go to my list</a></div></section>';
    } else {
      nextHtml = '<section class="next-call" aria-labelledby="nextH"><span class="lbl">Your list</span><h2 id="nextH">Every business has an outcome.</h2>' +
        '<p class="pitch-line">Ask Station for your next batch, ' + batchWords() + '.</p><div class="next-go"><a class="btn btn-dark btn-big" id="callGo" href="#calls">Ask for my next batch</a></div></section>';
    }
    var fresh = !Object.keys(S.log).length && !S.calls.length, lb = BOX.lineback;
    var side = fresh
      ? '<a class="start-here" href="#box/lineback"><span class="lbl">New here? Learn this one first</span><span class="name">' + esc(lb.name) + '</span><span class="what">' + esc(lb.what) + '. The easiest to explain on a first call.</span><span class="earn">You earn ' + money(lb.earn) + ' a month per paying client</span><span class="go">Read the Lineback cheat sheet <span aria-hidden="true">&rarr;</span></span></a>'
      : '<div class="start-here today"><span class="lbl">Today</span><div class="stats"><div><b>' + st.calls + '</b><span>calls logged</span></div><div><b>' + st.talked + '</b><span>conversations</span></div><div><b>' + st.warm + '</b><span>interested or won</span></div></div>' +
        '<span class="small">Every call you log keeps your list moving and your credit safe.</span></div>';
    var moneyBox = '<a class="money-box' + (t.ready ? '' : ' zero') + '" href="#money"><span class="lbl">Earned so far</span><span class="big num">' + (t.unknown ? '—' : money(t.ready)) + '</span>' +
      '<span class="row">' + moneyLine(t) + '</span>' +
      setupLine() +
      '<span class="go">See my money <span aria-hidden="true">&rarr;</span></span></a>';
    mount('<div class="wrap home"><div class="hello"><div><h1>Hi ' + esc(S.name) + '.</h1></div></div>' + nextHtml +
      '<div class="top-row">' + (fresh ? side + moneyBox : moneyBox + side) + '</div>' +
      '<a class="btn btn-big btn-block all-products" href="#products">See all ' + PW.boxes.length + ' products</a>' +
      '<a class="buyers-link" href="#buyers"><b>Who buys? Ten real buyers</b><span>What each is feeling, and the words that work.</span></a></div>', 'Home');
    tick = setInterval(function () {
      if (!/^#?(home)?$/.test(location.hash)) return;
      var n2 = localTime(where), el = document.getElementById('callNote'); if (!el) return;
      el.textContent = closedNote(n2); el.classList.toggle('closed-note', !n2.ok); el.hidden = n2.ok;
      document.getElementById('callGo').textContent = n2.ok ? 'Start calling' : 'See my list';
    }, 60000);
  };


  function moneyLine(t) {
    if (t.unknown) return 'Your money couldn’t load just now. It’s safe at Station.';
    if (!t.ready) return 'No commission yet. It shows here once a client’s first payment clears.';
    var b = (MONEY && MONEY.totals && MONEY.totals.blockers) || [], min = ((MONEY && MONEY.min_cents) || 5000) / 100;
    if (b.length) return 'Ready, and paid once the setup steps are done.';
    if (t.ready < min) return 'Paid once ' + money(min) + ' or more is ready.';
    return 'Ready for your next payout.';
  }
  function setupLine() {
    if (!DEMO && !MONEY) return '';
    if (DEMO) return '<span class="row warnline">2 setup steps before Station can pay you</span>';
    var n = (MONEY.tax_received ? 0 : 1) + (MONEY.account_state === 'ready' ? 0 : 1);
    return n ? '<span class="row warnline">' + n + (n === 1 ? ' setup step' : ' setup steps') + ' before Station can pay you</span>' : '';
  }
  /* ---------- what one paying client is worth: arithmetic from published prices, never a forecast ---------- */
  var WORTH_IDS = ['bundle-answer', 'bundle-getfound', 'bundle-followup', 'bundle-core', 'bundle-pro', 'bundle-custom', 'lineback', 'frontdesk', 'repute'];
  function worthTable() {
    var rows = WORTH_IDS.map(function (id) {
      var b = BOX[id]; if (!b || !b.earn) return '';
      return '<tr><th scope="row">' + esc(b.short || b.name) + '</th><td class="r num">' + money(b.earn) + '</td><td class="r num">' + money(b.earn * 12) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th scope="col">One paying client on</th><th scope="col" class="r">You earn a month</th><th scope="col" class="r">12 months of payments</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small fine">Arithmetic from published prices: 40% of what the client pays. It is not a forecast. Nothing is earned during a free trial, and refunds and cancellations reduce it. Yearly prepaid plans pay out in monthly installments, so ask Station before offering one.</p>';
  }
  function yesToPaid() {
    return '<ol class="route paid-route">' +
      '<li class="say"><small>1 They say yes</small>Send your link and mark the lead Won. Station checks it and sets them up.</li>' +
      '<li class="say"><small>2 Free trial</small>' + TD + ' days for single products and collections. Core, Pro and Max have no trial. Nothing is earned during a trial.</li>' +
      '<li class="say"><small>3 First payment clears</small>Your 40% starts here.</li>' +
      '<li class="say"><small>4 Held up to 30 days</small>A new client’s first payment is held up to 30 days for refunds and chargebacks. Renewals aren’t held.</li>' +
      '<li class="say"><small>5 You’re paid</small>Every two weeks, once $50 or more is ready and your tax form and Stripe account are set up.</li></ol>' +
      '<p class="small fine">So a yes on a collection is weeks, not days, before money lands. Plans skip the trial, so they start sooner.</p>';
  }

  /* ---------- the product catalogue ---------- */
  function boxCard(b) {
    var badges = '';
    if (b.easy) badges += '<span class="badge first">Good first pick</span>';
    
    var earn = b.earn ? '<span class="earn"><b class="amt num">' + money(b.earn) + '</b> a ' + period(b) + ' per paying client</span>'
      : '<span class="earn tbd">You earn 40% of their monthly care plan</span>';
    return '<a class="box" href="#box/' + b.id + '"><div class="badges">' + badges + '</div><span class="name">' + esc(b.name) + '</span><span class="what">' + esc(b.blurb || b.what) + '</span>' + earn + '</a>';
  }
  function easyFirst(a, b) { var k = function (x) { return x.easy ? 0 : x.id === 'website' ? 2 : 1; }; return k(a) - k(b); }
  VIEWS.products = function () {
    chrome(true, 'products');
    var f = S.filter;
    if (['all', 'easy', 'pay', 'collections', 'plans'].indexOf(f) < 0) f = 'all';
    var list = PW.boxes.slice(), groups = '', note = '';
    var isColl = function (b) { return b.bundle && b.kind === 'collection'; }, isPlan = function (b) { return b.bundle && b.kind === 'plan'; };
    if (f === 'easy') { list = list.filter(function (b) { return b.easy; }); note = 'The simplest ones to explain on a first call.'; }
    if (f === 'pay') { list = list.filter(function (b) { return b.earn && !b.bundle; }).sort(function (a, b) { return perMonth(b) - perMonth(a); }); note = 'Single products, ranked by what you earn per client each month. Collections and plans pay more: see those filters. Pitch what fits first. A small sale that stays beats a big one that gets refunded.'; }
    if (f === 'collections') { list = list.filter(isColl); note = 'Three ways to fix one problem. Each has a ' + TD + '-day free trial and a free Station-built website.'; }
    if (f === 'plans') { list = list.filter(isPlan); note = 'The whole lineup at three sizes. No free trial; there’s a 30-day money-back guarantee on the first paid month.'; }
    if (f !== 'all') groups = '<p class="filter-note">' + note + '</p><div class="grid' + (f === 'collections' || f === 'plans' ? ' colls' : '') + '">' + list.map(boxCard).join('') + '</div>';
    else {
      var singles = list.filter(function (b) { return !b.bundle; }).sort(easyFirst), colls = list.filter(isColl), plans = list.filter(isPlan);
      groups = '<h2 class="sub-h">Start here: three collections, one problem each</h2><p class="filter-note">Not sure which? Start with Answer. It’s the easiest to explain: it fixes missed calls and messages.</p><div class="grid colls">' + colls.map(boxCard).join('') + '</div>' +
        '<h2 class="sub-h">Single products</h2><div class="grid">' + singles.map(boxCard).join('') + '</div>' +
        (plans.length ? '<h2 class="sub-h">The whole lineup: three plans</h2><div class="grid colls">' + plans.map(boxCard).join('') + '</div>' : '');
    }
    var chip = function (k, label) { return '<button class="chip" type="button" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + label + '</button>'; };
    mount('<div class="wrap home"><div class="hello"><div><h1>Products</h1><p>Pick one, learn it in 2 minutes, start calling.</p><p class="small fine">What you earn is shown per paying client. It’s the math, not a forecast or a promise.</p></div></div>' +
      '<a class="buyers-link" href="#buyers"><b>Not sure what to pitch? See who buys</b></a>' +
      '<section id="wall" aria-label="Products you can sell"><div class="filters-wrap"><div class="filters" role="group" aria-label="Show">' + chip('all', 'Everything') + chip('easy', 'Easiest') + chip('pay', 'Top pay') + chip('collections', 'Collections') + chip('plans', 'Plans') + '</div></div>' +
      groups + '</section></div>', 'Products');
    main.querySelectorAll('[data-f]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var y = window.scrollY;
        S.filter = btn.getAttribute('data-f'); save(); VIEWS.products();
        window.scrollTo(0, Math.min(y, document.getElementById('wall').offsetTop));
        var fc = main.querySelector('[data-f="' + S.filter + '"]'); fc.focus({ preventScroll: true });
        fc.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    });
  };

  /* ---------- the call script ---------- */
  function introLine() { return 'Hi, is this the owner? My name is ' + S.name + ', and I’m an independent partner with Station. I’ll be quick.'; }
  function gateLine() { return 'It’s ' + S.name + ', an independent partner with Station. Is the owner around, or when’s a good time to catch them?'; }
  function vmLine(l) { return 'Hi, this is ' + S.name + ', an independent partner with Station, calling for the owner of ' + l.name + '. I’ll try you again another day. Thanks!'; }
  function extrasHtml(l) {
    return '<details class="script-peek"><summary>If someone else answers</summary><div class="say"><small>Say</small>' + esc(gateLine()) + '</div></details>' +
      '<details class="script-peek"><summary>If you get voicemail</summary><div class="say"><small>Say</small>' + esc(vmLine(l)) + '</div><p class="small">Then tap Voicemail. You can try them again tomorrow.</p></details>';
  }
  function earnShort(b) { return b.earn ? money(b.earn) + (period(b) === 'quarter' ? '/qtr' : '/mo') + ' to you' : b.id === 'website' ? '40% of care plan' : ''; }
  function closeLineOf(b) { return (b.call && b.call.close) || 'Want me to send you the link so you can take a look? What’s the best email?'; }
  function priceLine(b) {
    var r = (b.replyFix || {})['How much is it?'];
    return r ? r.replace(/^Good question\. /, '').replace(/ Every price is published on station\.solutions\.$/, '') : b.price;
  }
  function script(b) {
    var c = b.call || {}, lines = [];
    lines.push(['Say who you are', introLine(b)]);
    lines.push(['Open with', openerOf(b)]);
    if (c.discovery) lines.push(['Then ask', c.discovery]);
    lines.push(['The pitch', c.pitch || PW.pitch]);
    lines.push(['Close', closeLineOf(b)]);
    return lines;
  }
  function sayBoxes(lines, numbered) {
    return '<ol class="route">' + lines.map(function (l, k) { return '<li class="say"><small>' + (numbered ? ('0' + (k + 1)).slice(-2) + ' ' : '') + l[0] + '</small>' + esc(l[1]) + '</li>'; }).join('') + '</ol>';
  }
  function quickLines(b) { return [['Say who you are', introLine(b)], ['Open with', openerOf(b)], ['If they ask the price', priceLine(b)], ['Close', closeLineOf(b)]]; }
  function scriptText(b) { return script(b).map(function (l) { return l[1]; }).join('\n\n'); }
  function repliesBlock(b) {
    var h = '';
    if (b.call && b.call.objection) h += '<details class="acc" open><summary>The push-back you’ll hear most on ' + esc(b.name) + '</summary><div><p>' + esc(b.call.objection) + '</p></div></details>';
    var mine = linkFor(b).replace(/^https?:\/\//, '');
    var smaller = { frontdesk: 'Lineback', 'bundle-core': 'a collection such as Answer', 'bundle-pro': 'the Core plan', 'bundle-custom': 'the Pro plan' }[b.id];
    var named = b.bundle ? 'the ' + b.name : b.name;
    function fill(t) {
      t = t.replace('station.solutions/[product]/?ref=[yourcode]', mine).replace(/\[link\]/g, mine).replace(/\[yourcode\]/g, code()).replace(/\[your name\]/g, S.name).replace(/on \[day\]/g, 'later this week');
      t = smaller ? t.replace(/\[smaller option\]/g, smaller) : t.replace(/ ?If \[product\] is more than you need, \[smaller option\] may do the job\./, '');
      if (b.kind === 'plan') t = t.replace(/ ?Single products start with a 14-day free trial and there[’']s no contract, so you can try it\./, ' There’s no contract, and the first paid month has a 30-day money-back guarantee.');
      else if (b.kind === 'collection') t = t.replace('Single products start with a 14-day free trial', 'It starts with a 14-day free trial').replace(', and single products start with a 14-day free trial', ', and it starts with a 14-day free trial');
      if (b.kind === 'plan') t = t.replace(', and single products start with a 14-day free trial', ', and the first paid month has a 30-day money-back guarantee');
      else if (!b.trial) t = t.replace(/ ?Single products start with a 14-day free trial and there[’']s no contract, so you can try it\./, ' There’s no contract.');
      return t.replace(/\[product\]/g, named);
    }
    if (b.brand === 'station') PW.replies.forEach(function (r) {
      var say = fill((b.replyFix || {})[r.they] || r.say);
      h += '<details class="acc"><summary>“' + esc(r.they) + '”</summary><div><div class="say"><small>Say</small>' + esc(say) + '</div>' + (r.dont ? '<div class="dont"><b>Don’t say</b>' + r.dont + '</div>' : '') + '</div></details>';
    });
    return h;
  }
  function priceNote(b) {
    if (b.brand !== 'station') return '';
    if (b.id === 'website') return 'There’s no published price, so never quote one. Station quotes after the free demo.';
    if (b.kind === 'plan') return 'Check the live page before you quote. Plans have no free trial; there’s a 30-day money-back guarantee on the first paid month, and a free Station-built website comes with it.';
    if (b.bundle) return 'Check the live page before you quote. It starts with a ' + TD + '-day free trial, and a free Station-built website comes with it.';
    return 'Check the live product page before you quote. It starts with a ' + TD + '-day free trial, with no contract.';
  }

  /* ---------- one product: a short cheat sheet first, everything else folded below ---------- */
  VIEWS.box = function (id) {
    var b = BOX[id]; if (!b) { location.replace('#products'); return; }
    chrome(true, 'products');
    var link = linkFor(b);
    var earnNote = b.kind === 'plan' ? 'That’s 40% of the plan price, starting with their first monthly payment once it clears. Plans have no free trial, so there’s nothing to wait for.'
      : b.bundle ? 'That’s 40% of the collection price, starting after their ' + TD + '-day free trial, once the payment clears. The free Station-built website earns nothing; the monthly price does.'
      : b.id === 'website' ? 'Station quotes each client’s monthly hosting & care. You earn 40% of whatever they pay for it, every month. The build fee earns nothing.'
      : b.id === 'revive' ? 'That’s 40% of the $197 each client pays per month, starting after their ' + TD + '-day free trial, once the payment clears.'
      : b.id === 'echo' ? 'That’s 40% of the $247 each client pays per month, starting after their ' + TD + '-day free trial. There’s no setup fee.'
      : 'That’s 40% of what each client pays, starting after their ' + TD + '-day free trial, once the payment clears.';
    var buys = (PW.buyers || []).filter(function (y) { return y.fit === b.id; });
    function whoBuysRow(list) { return list.length ? '<div class="cheat-row"><span class="cheat-lbl">Who buys it</span><p class="who-buys">' + list.map(function (y) { return '<a href="#buyers/' + y.id + '">' + esc(y.name) + ': ' + esc(y.line) + '</a>'; }).join('') + '</p></div>' : ''; }
    function row(label, body, say) { return '<div class="cheat-row' + (say ? ' is-say' : '') + '"><span class="cheat-lbl">' + label + '</span><p>' + esc(body) + '</p></div>'; }
    var cheat = '<section class="cheat" aria-labelledby="cheatH"><h2 id="cheatH">' + esc(b.name) + ' cheat sheet</h2>' +
      row('Who it’s for', b.who) + whoBuysRow(buys) + row('Open with', openerOf(b), 1) + row('If they ask the price', priceLine(b), 1) + row('Close', closeLineOf(b), 1) +
      (b.call && b.call.objection ? row('The push-back you’ll hear', b.call.objection) : '') +
      '<div class="cheat-row"><span class="cheat-lbl">Your link</span><div class="copyrow"><code>' + esc(link) + '</code><button class="btn" type="button" data-copy-link>Copy</button></div></div>' +
      '<p class="small fine">Suggested words. Say it your way, and keep the facts and the rules.</p></section>';
    var more = [
      ['The full script', sayBoxes(script(b), true) + '<button class="link-btn" type="button" data-copy-script>Copy the whole script</button>'],
      ['If they push back', repliesBlock(b) || '<p>Keep it simple: answer the question, then offer to send the link.</p>'],
      ['When they say yes', b.id === 'website' ? '<ul class="ticks"><li>Send them your link to the questions, so the demo is credited to you.</li><li>Mark the call <strong>Interested</strong>. Station builds the free demo and quotes the project.</li><li>Mark it <strong>Won</strong> only when Station tells you they’ve said yes. You earn on their monthly hosting & care.</li></ul>'
        : '<ul class="ticks"><li>If they want to look first, mark the call <strong>Interested</strong> and send them your link. They stay on your list.</li><li>When they’re signing up, mark it <strong>Won</strong> and send the link, so the sale is credited to you. Station checks it and sets everything up; you don’t set anything up yourself.</li><li>You earn once they start paying. Station handles billing and support.</li></ul>'],
      ['Why they buy it', '<ul class="ticks">' + (b.why.length ? b.why : [b.what]).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>'],
      ['Price details', '<p><strong>' + esc(b.price) + '</strong></p>' + (priceNote(b) ? '<p class="small">' + priceNote(b) + '</p>' : '')],
      ['More about ' + esc(b.name), b.about.map(function (p) { return p.indexOf('<ul') === 0 ? p : '<p>' + p + '</p>'; }).join('')]
    ].map(function (m) { return '<details class="more"><summary><h3>' + m[0] + '</h3></summary><div>' + m[1] + '</div></details>'; }).join('');
    mount('<div class="wrap prod"><a class="back" href="#products">&larr; All products</a>' +
      '<div class="prod-top"><h1>' + esc(b.name) + '</h1><p class="what">' + esc(b.what) + '</p>' +
      '<p class="earn-line">' + (b.earn ? 'You earn <b class="num">' + money(b.earn) + '</b> a ' + period(b) + ' per paying client' : 'You earn 40% of their monthly care plan') + '</p></div>' + cheat +
      '<div class="earn-card"><span class="lbl">What you earn per paying client</span>' +
      (b.earn ? '<div class="big num">' + money(b.earn) + '</div><div class="per">every ' + period(b) + ' they keep paying &middot; ' + money(b.earn * 12) + ' over 12 months of payments</div>' : '<div class="big">40% of their monthly care</div>') +
      '<p>' + earnNote + ' Nothing is earned during a trial, and it’s arithmetic, not a forecast.</p></div>' +
      '<h2 class="more-h">Everything else</h2><div class="more-list">' + more + '</div></div>' +
      '<div class="cta-bar"><a class="btn btn-dark btn-big" href="#calls/' + b.id + '">Start calling for ' + esc(b.name) + '</a></div>', b.name);
    var cl = main.querySelector('[data-copy-link]'); cl.addEventListener('click', function () { copy(link, cl); });
    var cs = main.querySelector('[data-copy-script]'); cs.addEventListener('click', function () { copy(scriptText(b), cs); });
  };

  /* ---------- the feed ---------- */
  function feedEl() { return document.getElementById('feed'); }
  function zoom() { return parseFloat(getComputedStyle(document.body).zoom) || 1; }
  function sizeFeed() {
    var f = feedEl(); if (!f) return;
    var tb = document.getElementById('tabbar'), under = getComputedStyle(tb).display === 'none' ? 0 : tb.getBoundingClientRect().height;
    var ub = document.getElementById('undo');
    if (ub && !ub.hidden) { // measure where the bar comes to rest, not where its slide-in animation is right now
      var ty = 0; try { ty = new DOMMatrix(getComputedStyle(ub).transform).m42 || 0; } catch (e) {}
      under = window.innerHeight - (ub.getBoundingClientRect().top - ty) + 8;
    }
    f.style.height = Math.max(160, (window.innerHeight - f.getBoundingClientRect().top - under) / zoom()) + 'px';
  }
  window.addEventListener('resize', sizeFeed);
  /* scroll the FEED, never the page: scrollIntoView would also scroll the window and slide the page off the screen */
  function feedShow(el, whole, instant) {
    var f = feedEl(); if (!f || !el) return;
    var fr = f.getBoundingClientRect(), r = el.getBoundingClientRect(), z = zoom();
    var how = instant || reduced ? 'instant' : 'smooth';
    if (whole) { f.scrollTo({ top: f.scrollTop + (r.top - fr.top) / z, behavior: how }); return; }
    if (r.bottom > fr.bottom) f.scrollTo({ top: f.scrollTop + (r.bottom - fr.bottom) / z + 12, behavior: how });
    else if (r.top < fr.top) f.scrollTo({ top: f.scrollTop + (r.top - fr.top) / z - 12, behavior: how });
  }
  function cardEl(id) { return document.getElementById('lead-' + id); }

  VIEWS.calls = function (id) {
    clearInterval(tick); tick = null;
    if (id && sellable(BOX[id])) { S.focus = id; S.focusDay = today(); save(); }
    chrome(true, 'calls');
    var leads = sortedLeads();
    var cards = leads.map(function (l, k) { return leadCard(l, k, leads.length); }).join('');
    cards += '<article class="lead" id="endCard"><div class="lead-card end-card"></div></article>';
    var focus = sellable(BOX[S.focus]) && S.focusDay === today() ? BOX[S.focus] : null;
    mount('<h1 class="sr">Calls</h1><div class="calls-top">' +
      '<div class="prog"><div class="prog-row"><span class="count" id="leftCount" aria-live="polite"></span><span class="small" id="triedCount"></span><button class="size-btn small-size" type="button" data-size aria-pressed="' + !!S.big + '" aria-label="AA Bigger text"><span aria-hidden="true">A<b>A</b></span></button></div>' +
      '<div class="bar-track" aria-hidden="true"><i id="progBar"></i></div></div>' +
      (focus ? '<div class="focus-chip"><span>Pitching <b>' + esc(focus.name) + '</b> to everyone today</span><button class="link-btn" type="button" id="clearFocus">Use each business’s best fit</button></div>' : '') +
      '</div><div class="calls-body"><div class="feed" id="feed" role="region" aria-label="Businesses to call, one per screen">' + cards + '</div>' +
      '<aside class="side" id="side" aria-label="Your lines for the business on screen"></aside></div>', 'Calls');
    var cf = document.getElementById('clearFocus');
    if (cf) cf.addEventListener('click', function () { S.focus = ''; save(); history.replaceState(null, '', '#calls'); VIEWS.calls(); toast('Each business now gets its best fit.'); });
    feedEl().querySelectorAll('.lead[data-id]').forEach(wireCard);
    wireKeys(); updateEnd(); sizeFeed(); wireSide();
    tick = setInterval(refreshTimes, 15000); // times go stale and calling hours open or close while the page sits there
    if (!S.toured) setTimeout(startTour, 450);
  };
  var sideObs = null, sideRaf = 0, SIDE_MQ = window.matchMedia ? matchMedia('(min-width: 1100px)') : null;
  function currentCard() {
    var f = feedEl(); if (!f) return null;
    var ft = f.getBoundingClientRect().top, best = null, d = 1e9;
    f.querySelectorAll('.lead[data-id]').forEach(function (c) { var x = Math.abs(c.getBoundingClientRect().top - ft); if (x < d) { d = x; best = c; } });
    return best;
  }
  function wireSide() {
    var f = feedEl(); if (!f) return;
    if (!f.hasAttribute('data-side')) {
      f.setAttribute('data-side', '1');
      f.addEventListener('scroll', function () { cancelAnimationFrame(sideRaf); sideRaf = requestAnimationFrame(function () { var c = currentCard(); if (c && SIDE_MQ && SIDE_MQ.matches) drawSide(c.getAttribute('data-id')); }); }, { passive: true });
    }
    var c = currentCard(); if (c && SIDE_MQ && SIDE_MQ.matches) drawSide(c.getAttribute('data-id'));
  }
  if (SIDE_MQ && SIDE_MQ.addEventListener) SIDE_MQ.addEventListener('change', function () { var sd = document.getElementById('side'); if (sd) sd.removeAttribute('data-for'); wireSide(); sizeFeed(); });
  function drawSide(id) {
    var side = document.getElementById('side'), l = LEAD[id]; if (!side || !l || side.getAttribute('data-for') === id) return;
    var b = pitchFor(l); side.setAttribute('data-for', id);
    side.innerHTML = '<h2 class="side-h">Your lines for ' + esc(l.name) + '</h2><p class="small">Pitching ' + esc(b.name) + '.</p>' +
      sayBoxes(script(b), true) + extrasHtml(l) + '<button class="link-btn" type="button" data-side-script>Every push-back answer</button>' +
      '<p class="keys small"><b>Keys:</b> J next · K back · C call · L how did it go · 1–4 pick an outcome · U undo</p>';
    side.querySelector('[data-side-script]').addEventListener('click', function () { openScript(b); });
  }
  function updateEnd() {
    var c = counts(), end = document.querySelector('#endCard .lead-card'); if (!end) return;
    document.getElementById('leftCount').textContent = c.tried + ' called';
    document.getElementById('triedCount').textContent = c.fresh + ' new left';
    document.getElementById('progBar').style.width = (LEADS.length ? Math.round(100 * c.tried / LEADS.length) : 0) + '%';
    var due = c.due ? c.due + (c.due === 1 ? ' call-back' : ' call-backs') + ' due' : '';
    var later = LEADS.filter(function (l) { return rank(l) < 4 && triedToday(S.log[l.id]); }).length, todayN = c.toCall - c.fresh - later;
    var more = (todayN ? ' ' + todayN + (todayN === 1 ? ' business is' : ' businesses are') + ' still open for today.' : '') + (later ? ' ' + later + ' you tried today come back tomorrow.' : '');
    var h, p, btn = '', upTo = batchWords();
    if (!DEMO && !LEADS.length && !dealtTotal()) {
      h = 'Station hasn’t sent you businesses yet.';
      p = 'When it does, they show up here, one per screen, with the words to say on each.';
    } else if (c.fresh) {
      h = c.fresh + (c.fresh === 1 ? ' business is' : ' businesses are') + ' still new.';
      p = 'When every new business has an outcome, you can ask Station for your next batch, ' + upTo + '.' + (due ? ' You also have ' + due + '.' : '');
      btn = '<button class="btn btn-dark btn-big" type="button" id="toFirst">Go to the first one</button>';
    } else if (!S.asked) {
      h = 'Every business has an outcome.';
      p = 'Ask Station for your next batch, ' + upTo + '. Station reviews each request.' + more;
      btn = '<button class="btn btn-dark btn-big" type="button" id="askMore">Ask for my next batch</button>' + (todayN ? '<button class="btn" type="button" id="toFirst">Go to the ones still open</button>' : '');
    } else {
      h = 'Next batch: waiting for Station’s OK';
      p = '<span class="asked-line">✓ Asked ' + askedText() + '. Station reviews every request, then your new businesses show up here.</span>' + (DEMO ? ' (This preview doesn’t send anything.)' : '') + more;
      btn = todayN ? '<button class="btn" type="button" id="toFirst">Go to the ones still open</button>' : '';
    }
    end.innerHTML = '<h2>' + h + '</h2><p>' + p + '</p>' + btn;
    var tf = document.getElementById('toFirst');
    if (tf) tf.addEventListener('click', function () {
      var first = [].filter.call(feedEl().querySelectorAll('.lead[data-id]'), function (el) {
        var l = LEAD[el.getAttribute('data-id')]; if (!l) return false; return c.fresh ? rank(l) < 3 : rank(l) < 4 && !triedToday(S.log[l.id]);
      })[0];
      goTo(first, true);
    });
    var am = document.getElementById('askMore');
    if (am) am.addEventListener('click', function () {
      if (!DEMO) { askForMore(am); return; }
      S.asked = true; S.askedAt = Date.now(); save(); updateEnd(); var e2 = document.querySelector('#endCard .lead-card'); if (e2) e2.classList.add('pop');
    });
  }
  function refreshTimes() {
    if (location.hash.indexOf('#calls') !== 0 || !feedEl()) { clearInterval(tick); tick = null; return; }
    feedEl().querySelectorAll('.lead[data-id]').forEach(function (card) {
      var l = LEAD[card.getAttribute('data-id')]; if (!l) { if (!card.contains(document.activeElement)) card.remove(); return; } // Station took it back
      var t = localTime(l.st), line = card.querySelector('[data-time]');
      if (!line) return;
      line.className = t.ok ? 'okc' : 'late'; line.textContent = timeLine(t);
      if (String(t.ok) !== card.getAttribute('data-ok')) applyHours(card, l, t);
    });
    feedEl().querySelectorAll('.lead[data-id]').forEach(function (card) {
      var l = LEAD[card.getAttribute('data-id')]; if (!l || !card.parentNode) return;
      var rk = String(rank(l));
      if (rk === card.getAttribute('data-rank') || card.contains(document.activeElement)) return;
      var fresh = renderCard(card);
      if (rk === '0') {
        toast('Call-back due now: ' + l.name + '.');
        var f = feedEl(), busy = f.contains(document.activeElement) && document.activeElement !== f || !sheet.hidden;
        if (!busy) { f.insertBefore(fresh, f.querySelector('.lead[data-id]')); f.querySelectorAll('.lead[data-id]').forEach(function (c) { renderCard(c); }); }
      }
    });
  }
  function applyHours(card, l, t) {
    card.setAttribute('data-ok', String(t.ok));
    var btn = card.querySelector('.call-btn');
    if (btn) { var tmp = document.createElement('div'); tmp.innerHTML = callBtnHtml(l, t); btn.parentNode.replaceChild(tmp.firstChild, btn); }
    var cn = card.querySelector('[data-copynum]');
    if (!t.ok && cn) cn.parentNode.removeChild(cn);
    if (t.ok && !cn && btn && !touch && !triedToday(S.log[l.id])) card.querySelector('[data-script]').insertAdjacentHTML('afterend', '<button class="link-btn" type="button" data-copynum>Copy number</button>');
  }
  function callBtnHtml(l, t) {
    if (triedToday(S.log[l.id])) return '<button class="btn call-btn closed" type="button" disabled>✓ Tried today<small>Back on your list tomorrow</small></button>';
    if (!t.ok) return '<button class="btn call-btn closed" type="button" disabled>' + (t.unknown ? 'Check their local time' : 'Calls open ' + t.opens) + '<small>The number shows when calls open</small></button>';
    var s = S.log[l.id], again = s && (s.o === 'interested' || s.wasInterested);
    return '<a class="btn ' + (again ? 'call-again' : 'btn-green') + ' call-btn" href="tel:' + l.dial + '" data-call>' + (again ? 'Call again' : touch ? 'Call now' : 'Call') + '<small>' + esc(l.phone) + '</small></a>';
  }
  /* call-back choices, without two buttons that land on the same day (Saturday: tomorrow and in 2 days are both Monday) */
  function dayButtons(ok) {
    var o = [], seen = {};
    if (ok) { o.push([0, 'Later today']); seen[today()] = 1; }
    [[1, 'Tomorrow'], [2, 'In 2 days'], [7, 'Next week']].forEach(function (x) {
      var d = addDays(x[0]); if (seen[d]) return; seen[d] = 1;
      var lab = x[0] < 7 && d !== ymd(new Date(Date.now() + x[0] * 864e5)) ? new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' }) : x[1];
      o.push([x[0], lab]);
    });
    return o.map(function (x, i) { return '<button type="button"' + (o.length % 2 && i === o.length - 1 ? ' class="wide"' : '') + ' data-day="' + x[0] + '">' + x[1] + '</button>'; }).join('');
  }
  function goTo(el, instant) {
    if (!el) return;
    if (pending && el.getAttribute('data-id') !== pending.id) setPending(null); // a call you moved away from is never logged against the next business
    feedShow(el, true, instant);
    if (instant && !reduced) { el.classList.remove('arrive'); void el.offsetWidth; el.classList.add('arrive'); }
    var f = el.querySelector('.call-btn:not([disabled])') || el.querySelector('[data-log]') || el.querySelector('.btn:not([disabled])') || el.querySelector('button');
    if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 350);
  }
  function wireKeys() {
    feedEl().addEventListener('keydown', function (e) {
      if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || /input|select|textarea/i.test(e.target.tagName)) return;
      var cur = e.target.closest && e.target.closest('.lead'); if (!cur) return;
      e.preventDefault(); goTo(e.key === 'ArrowDown' ? cur.nextElementSibling : cur.previousElementSibling);
    });
  }

  function cleanEmail(e) { return String(e || '').replace(/[\s?&#<>"']/g, ''); }
  function sendBox(l, s) {
    var bx = BOX[s.box] || pitchFor(l), link = linkFor(bx), when = new Date(s.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    var web = bx.id === 'website', named = bx.bundle ? 'the ' + bx.name : bx.name;
    var body = 'Hi, thanks for talking with me. ' + (web ? 'Here are the questions for your custom website I mentioned: ' : 'Here’s the ' + named + ' page I mentioned. It shows the price and how it works: ') + link +
      '\n\nQuestions? Just reply to this email.\n\n' + S.name + ', independent partner with Station (Station Automations Group LLC, Houston, Texas)\nIf you’d rather not get emails from me, reply and say so, and I won’t send more.';
    var subject = web ? 'Your custom website questions' : 'The ' + named + ' page I mentioned';
    var head = s.o === 'won' ? '<strong>Won on ' + when + '.</strong> ' + (bx.earn ? '<b class="plus">+' + money(bx.earn) + ' a ' + period(bx) + '</b> to you once they start paying' + (bx.trial ? ' (after their ' + TD + '-day trial)' : '') + '. ' : '') +
        (s.accepted ? 'Station has confirmed this win.' : 'Send them your link so the sale is credited to you. Station checks it and sets them up.')
      : '<strong>Interested in ' + esc(bx.name) + '.</strong> Send them your link so they can look, and so any sale is credited to you. They stay on your list.';
    return '<div class="won-next' + (s.o === 'won' ? '' : ' warm') + '"><p>' + head + '</p>' +
      '<label class="field slim" for="em-' + esc(l.id) + '">Their email <span class="ask">Ask: “What’s the best email to send it to?”</span><input class="text" type="email" id="em-' + esc(l.id) + '" data-email autocomplete="off" value="' + esc(s.email || '') + '" placeholder="owner@business.com"></label>' +
      '<div class="won-btns"><a class="btn btn-green" data-mail href="mailto:' + cleanEmail(s.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) + '">Email them the link</a><button class="btn" type="button" data-copy-won>Copy link</button></div>' +
      (s.o === 'won' && !s.accepted ? '<button class="link-btn" type="button" data-change>Marked Won by mistake? Change it</button>' : s.accepted ? '<p class="small">To change a confirmed win, email <a href="mailto:main@station.solutions">main@station.solutions</a>.</p>' : '') + '</div>';
  }
  /* Station's engine keeps Do not call and Bad lead for good once they reach it; only Station can lift them */
  function lockedAtStation(id, s) { return !DEMO && (s.o === 'dnc' || s.o === 'bad') && !queuedCall(id); }
  function doneBlock(l, s) {
    var when = new Date(s.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (s.o === 'won') return sendBox(l, s);
    return '<div class="done-box"><p><strong>' + esc(OUT[s.o]) + '</strong> · marked ' + when + '. ' + (s.o === 'dnc' ? 'Never call this business again.' : s.o === 'bad' ? 'Station takes it back.' : 'This business is finished.') + '</p>' +
      (lockedAtStation(l.id, s) ? '<p class="small">Marked by mistake? Email <a href="mailto:main@station.solutions">main@station.solutions</a> and Station will fix it.</p>' : '<button class="link-btn" type="button" data-change>Change this</button>') + '</div>';
  }
  function untilText(l) { return untilDate(l).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function stars(l) { return l.rating ? '<span>★ ' + l.rating + (l.reviews ? ' (' + l.reviews + ')' : '') + '</span>' : ''; }
  function placeOf(l) { return l.city ? (l.st && !/,\s*[A-Z]{2}$/.test(l.city) ? l.city + ', ' + l.st : l.city) : (l.st || ''); }
  function leadCard(l, k, n) {
    var t = localTime(l.st), s = S.log[l.id], rk = rank(l), closed = s && CLOSED[s.o], b = pitchFor(l), tt = triedToday(s);
    var pill = s ? '<span class="pill ' + (closed ? 'status' : rk === 0 ? 'due' : 'again') + '">' + esc(statusText(s)) + '</span>' : '<span class="pill">New</span>';
    var talked = s && (TALKED[s.o] || s.wasInterested), warm = s && (s.o === 'won' || (!closed && (s.o === 'interested' || s.wasInterested)));
    var shown = closed && BOX[s.box] ? BOX[s.box] : b, es = earnShort(shown);
    var fitNote = !talked && b.id !== l.fits && sellable(BOX[l.fits]) ? ' <button class="link-btn fit-btn" type="button" data-fit>Pitch ' + esc(BOX[l.fits].name) + ' instead (best fit)</button>' : '';
    var eid = esc(l.id);
    return '<article class="lead" id="lead-' + eid + '" data-id="' + eid + '" data-ok="' + t.ok + '" data-rank="' + rk + '" aria-labelledby="h-' + eid + '"><div class="lead-card' + (closed && s.o !== 'won' ? ' done' : '') + (warm ? ' warm' : '') + '">' +
      '<div class="lead-meta">' + (closed ? '' : '<button class="pill from" type="button" data-until>Yours till ' + untilDate(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</button>') + pill + (es ? '<span class="earn-pill">' + es + '</span>' : '') + '</div>' +
      '<div><h2 id="h-' + eid + '">' + esc(l.name) + '</h2><div class="facts"><span>' + esc(l.trade) + ' · ' + esc(placeOf(l)) + '</span>' + stars(l) + '</div></div>' +
      (closed ? '' : '<div class="facts"><span data-time class="' + (t.ok ? 'okc' : 'late') + '">' + timeLine(t) + '</span></div>') +
      '<div class="pitch-box"><div class="pitch-head"><span>' + (closed ? 'Pitched' : 'Pitch') + ' <b>' + esc(shown.name) + '</b></span>' +
      (closed ? '' : '<button class="link-btn" type="button" data-pitch>Change</button>') + '</div>' + (closed || !fitNote ? '' : '<div class="fit-row">' + fitNote + '</div>') +
      '<p class="opener"><span class="first">Say who you are, then:</span> “' + esc(openerOf(b)) + '”</p><p class="gap"><b>Why them:</b> ' + esc(l.gap) + '</p></div>' +
      (closed ? doneBlock(l, s) : (s && (s.o === 'interested' || s.wasInterested) ? sendBox(l, s) : '') + callBtnHtml(l, t)) +
      (closed ? '' : '<div class="card-lines">' + sayBoxes(quickLines(b)) + '</div>') +
      (closed ? '' : '<div class="card-actions"><button class="btn" type="button" data-log>How did it go?</button><button class="btn btn-next" type="button" data-next>Next business</button></div>') +
      '<div class="note-box"' + (S.notes[l.id] ? '' : ' hidden') + '><label class="sr" for="note-' + eid + '">Note about ' + esc(l.name) + '</label><input class="text" id="note-' + eid + '" placeholder="Business facts only, like: ask for Maria after 2" value="' + esc(S.notes[l.id] || '') + '"></div>' +
      '<div class="card-links"><button class="link-btn" type="button" data-note>' + (S.notes[l.id] ? 'Edit note' : 'Add a note') + '</button><button class="link-btn" type="button" data-script>Full script</button>' +
      (closed ? '' : '<button class="link-btn" type="button" data-vm>Voicemail?</button>') +
      (t.ok && !closed && !tt && !touch ? '<button class="link-btn" type="button" data-copynum>Copy number</button>' : '') /* on a phone, Call dials */ + (closed ? '<button class="link-btn" type="button" data-next>Next business</button>' : '') + '</div></div></article>';
  }
  function renderCard(card) {
    if (!LEAD[card.getAttribute('data-id')]) { card.remove(); updateEnd(); return null; } // Station took it back
    var l = LEAD[card.getAttribute('data-id')], list = [].slice.call(feedEl().querySelectorAll('.lead[data-id]')), k = list.indexOf(card);
    var tmp = document.createElement('div'); tmp.innerHTML = leadCard(l, k, list.length);
    var fresh = tmp.firstChild; card.parentNode.replaceChild(fresh, card); wireCard(fresh);
    var side = document.getElementById('side'); if (side && side.getAttribute('data-for') === l.id) { side.removeAttribute('data-for'); drawSide(l.id); }
    updateEnd();
    return fresh;
  }
  function wireCard(card) {
    var id = card.getAttribute('data-id'), l = LEAD[id];
    card.addEventListener('click', function (e) {
      if (performance.now() < tapGuard) {
        e.preventDefault();
        if (e.target.closest('[data-next]')) setTimeout(function () { var c = cardEl(id); if (c) goTo(c.nextElementSibling); }, tapGuard - performance.now() + 10);
        return;
      }
      var t = e.target;
      if (t.closest('[data-next]')) { goTo(card.nextElementSibling); return; }
      if (t.closest('[data-log]')) { openCallSheet(l, 'after'); return; }
      if (t.closest('[data-script]')) { openScript(pitchFor(l)); return; }
      if (t.closest('[data-pitch]')) { openPitchPicker(l); return; }
      if (t.closest('[data-vm]')) { openSheet('If you get voicemail', '<div class="say"><small>Say</small>' + esc(vmLine(l)) + '</div><p class="small">Then tap Voicemail when you log the call. They come back on your list tomorrow.</p>'); return; }
      if (t.closest('[data-until]')) {
        openSheet('Yours until ' + untilText(l), '<p>' + esc(l.name) + ' stays on your list until ' + untilText(l) + '. Every business Station sends you is yours for ' + holdDays() + ' days, and each call you log on it gives you another ' + holdDays() + ' days from that call.</p><p>If ' + holdDays() + ' days go by without a call logged, it goes back to Station’s shared list, so another partner can call it.</p>');
        return;
      }
      if (t.closest('[data-fit]')) { S.pitch[id] = l.fits; save(); var fr = renderCard(card); var pc = fr.querySelector('[data-pitch]'); if (pc) pc.focus(); toast('Pitching ' + BOX[l.fits].name + ' here.'); return; }
      var cn = t.closest('[data-copynum]'); if (cn) { copy(l.phone, cn); return; }
      if (t.closest('[data-note]')) { var nb = card.querySelector('.note-box'); nb.hidden = false; feedShow(nb); nb.querySelector('input').focus({ preventScroll: true }); return; }
      var cw = t.closest('[data-copy-won]'); if (cw) { copy(linkFor(BOX[S.log[id].box] || pitchFor(l)), cw); return; }
      var ch = t.closest('[data-change]');
      if (ch) {
        if (S.log[id].o === 'dnc' && ch.getAttribute('data-armed') !== '1') { ch.setAttribute('data-armed', '1'); ch.textContent = 'They asked not to be called. Only change it if you tapped it by mistake. Tap again to change.'; return; }
        openCallSheet(l, 'after', true); return;
      }
      var cb = t.closest('.call-btn');
      if (cb && !cb.disabled) {
        var now = localTime(l.st);
        e.preventDefault();
        if (!now.ok) { applyHours(card, l, now); toast('Calls just closed for this business.'); return; }
        if (touch && S.skipPrep) { startCall(l); location.href = 'tel:' + l.dial; return; }
        openCallSheet(l, 'before');
      }
    });
    var ni = card.querySelector('.note-box input'); ni.maxLength = NOTE_MAX;
    ni.addEventListener('input', function () { var v = this.value.slice(0, NOTE_MAX); if (v.trim()) S.notes[id] = v; else delete S.notes[id]; save(); noteChanged(id); });
    ni.addEventListener('change', function () { noteDone(id); });
    var em = card.querySelector('[data-email]');
    if (em) em.addEventListener('input', function () {
      S.log[id].email = em.value.trim().slice(0, 120); save();
      var a = card.querySelector('[data-mail]'); a.setAttribute('href', a.getAttribute('href').replace(/^mailto:[^?]*/, 'mailto:' + cleanEmail(S.log[id].email)));
    });
  }

  /* ---------- during a call: "Ready to call", then "How did it go?" when they come back from the phone ---------- */
  var pending = null, tapGuard = 0, CALL_KEY = KEY + '-call';
  /* a call in progress survives the phone reloading the tab while you were in the dialer */
  var savedCall = (function () { try { return JSON.parse(sessionStorage.getItem(CALL_KEY) || 'null'); } catch (e) { return null; } })();
  function setPending(v) { pending = v; try { if (v) sessionStorage.setItem(CALL_KEY, JSON.stringify(v)); else sessionStorage.removeItem(CALL_KEY); } catch (e) {} }
  function startCall(l) { setPending({ id: l.id, left: false, at: Date.now() }); }
  document.addEventListener('visibilitychange', function () {
    if (!pending) return;
    if (document.visibilityState === 'hidden') { pending.left = true; setPending(pending); return; }
    if (Date.now() - pending.at > 30 * 60e3) { setPending(null); return; }
    if (pending.left && location.hash.indexOf('#calls') === 0) { var l = LEAD[pending.id]; setPending(null); if (l) openCallSheet(l, 'during'); }
  });
  var ROW1 = '<button type="button" data-o="noanswer" aria-pressed="false">No answer<small>It rang out</small></button><button type="button" data-o="voicemail" aria-pressed="false">Voicemail<small>Got the machine</small></button>' +
    '<button type="button" data-o="bad" aria-pressed="false">Bad lead<small>Wrong number, closed, not a fit</small></button><button type="button" data-o="talked" aria-pressed="false" aria-expanded="false">Talked to them<small>Then pick how it went</small></button>';
  function openCallSheet(l, mode, changing, preset) {
    var ce = cardEl(l.id); if (ce && location.hash.indexOf('#calls') === 0) feedShow(ce, true, true); // the screen always shows the business the sheet names
    if (mode === 'after') setPending(null);
    var b = pitchFor(l), quick = sayBoxes(quickLines(b));
    if (mode === 'during') {
      openSheet('On the call with ' + l.name,
        '<p class="sheet-sub">When you hang up, tap how it went:</p>' + outcomeRows(l) +
        '<button class="link-btn" type="button" data-hungup>Add a note or see every option</button>' +
        '<h3 class="sheet-h">Still talking? Your lines</h3>' + quick + '<p class="small">If they’re interested, get their email before you hang up.</p>' + extrasHtml(l));
      var bd = document.getElementById('sheetBody');
      bd.querySelector('[data-hungup]').addEventListener('click', function () { openCallSheet(l, 'after'); });
      wireOutcomes(bd, l, false);
      return;
    }
    if (mode === 'before') {
      openSheet('Ready to call ' + l.name,
        '<a class="btn btn-green btn-big btn-block" href="tel:' + l.dial + '" data-dial>Call ' + esc(l.phone) + '</a>' +
        (touch ? (S.calls.length >= 3 ? '<label class="check"><input type="checkbox" data-skip' + (S.skipPrep ? ' checked' : '') + '> Skip this card and go straight to the phone next time</label>' : '')
               : '<p class="small center">Opens your calling app. No calling app? <button class="link-btn" type="button" data-copyonly>Copy the number</button> and dial it on your phone.</p>') +
        '<p class="tip"><b>Tip:</b> put the call on speaker somewhere private, then come back to this app. Your lines stay right here. Never record a call.</p>' + quick + extrasHtml(l) +
        '<button class="btn btn-block" type="button" data-hungup>I’ve hung up</button>');
      var body = document.getElementById('sheetBody');
      function stillOpen(e) { // the card may have sat open past 8 pm
        var now = localTime(l.st); if (now.ok) return true;
        e.preventDefault(); hideSheet(); var c = cardEl(l.id); if (c) applyHours(c, l, now); toast('Calls just closed for this business.'); return false;
      }
      body.querySelector('[data-dial]').addEventListener('click', function (e) { if (stillOpen(e)) startCall(l); });
      var cd = body.querySelector('[data-copyonly]'); if (cd) cd.addEventListener('click', function (e) { if (stillOpen(e)) { startCall(l); copy(l.phone, cd); } });
      body.querySelector('[data-hungup]').addEventListener('click', function () { setPending(null); openCallSheet(l, 'after'); });
      var sk = body.querySelector('[data-skip]'); if (sk) sk.addEventListener('change', function () { S.skipPrep = sk.checked; save(); });
      return;
    }
    openSheet('How did it go?',
      '<p class="sheet-sub">' + esc(l.name) + ' · pitching ' + esc(b.name) + '</p>' +
      (changing ? '' : '<details class="script-peek"><summary>Show my lines</summary>' + quick + '</details>') +
      '<label class="field slim note-in" for="sheetNote">Anything to remember? (optional)<input class="text" id="sheetNote" value="' + esc(S.notes[l.id] || '') + '" placeholder="Business facts only, like: ask for Maria after 2"></label>' +
      outcomeRows(l) + '<details class="script-peek"><summary>What do these buttons mean?</summary>' + glossaryHtml() + '</details>');
    var body = document.getElementById('sheetBody');
    body.querySelector('#sheetNote').addEventListener('input', function () {
      var v = this.value.slice(0, NOTE_MAX); if (v.trim()) S.notes[l.id] = v; else delete S.notes[l.id]; save(); noteChanged(l.id);
      var c = cardEl(l.id); if (!c) return; var nb = c.querySelector('.note-box'), ni = nb.querySelector('input'), nl = c.querySelector('[data-note]');
      ni.value = S.notes[l.id] || ''; nb.hidden = !S.notes[l.id]; if (nl) nl.textContent = S.notes[l.id] ? 'Edit note' : 'Add a note';
    });
    body.querySelector('#sheetNote').addEventListener('change', function () { noteDone(l.id); });
    wireOutcomes(body, l, changing);
    if (preset === 'talked') body.querySelector('[data-o="talked"]').click();
  }
  function outcomeRows(l) {
    return '<div class="outcomes big" data-row="1">' + ROW1 + '</div>' +
      '<div class="outcomes big" data-row="2" hidden><p class="small wide row-h" tabindex="-1">How did the conversation go?</p>' +
      '<button type="button" data-o="interested" aria-pressed="false">Interested<small>Wants to see more</small></button><button type="button" data-o="callback" aria-pressed="false" aria-expanded="false">Call back<small>You pick the day</small></button>' +
      '<button type="button" data-o="notint" aria-pressed="false">Not interested<small>They said no</small></button><button type="button" data-o="dnc" aria-pressed="false">Do not call<small>They asked you to stop</small></button>' +
      '<button type="button" class="wide won" data-o="won" aria-pressed="false">Won: they’re buying<small>Send them your link next</small></button></div>' +
      '<div class="outcomes big" data-row="day" hidden><p class="small wide row-h" tabindex="-1">When should you call them back?</p>' + dayButtons(localTime(l.st).laterOk) + '</div>';
  }
  function wireOutcomes(body, l, changing) {
    var r2 = body.querySelector('[data-row="2"]'), rd = body.querySelector('[data-row="day"]');
    function reveal(el) { el.hidden = false; el.classList.add('open-in'); el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); el.querySelector('.row-h').focus({ preventScroll: true }); }
    function pick(ob) {
      body.querySelectorAll('[data-o]').forEach(function (x) {
        var on = x === ob || (r2.contains(ob) && x.getAttribute('data-o') === 'talked');
        x.classList.toggle('sel', on); x.setAttribute('aria-pressed', String(on));
      });
      body.querySelector('[data-o="talked"]').setAttribute('aria-expanded', String(!r2.hidden || ob.getAttribute('data-o') === 'talked'));
    }
    body.addEventListener('click', function (e) {
      var ob = e.target.closest('[data-o]'), db = e.target.closest('[data-day]');
      if (ob) {
        var o = ob.getAttribute('data-o');
        pick(ob);
        if (o !== 'callback') { rd.hidden = true; body.querySelector('[data-o="callback"]').setAttribute('aria-expanded', 'false'); }
        if (o === 'talked') { reveal(r2); return; }
        if (o === 'callback') { ob.setAttribute('aria-expanded', 'true'); reveal(rd); return; }
        commit(l, o, null, changing);
      } else if (db) {
        var lt = localTime(l.st), n = +db.getAttribute('data-day'), late = n === 0 && !lt.laterOk; if (late) n = 1;
        commit(l, 'callback', n === 0 ? { due: today(), dueAt: Date.now() + 3 * 3600e3 } : { due: addDays(n) }, changing, late);
      }
    });
  }
  function record(l, o, extra, changing) {
    var prev = S.log[l.id] || {}, was = prev.o === 'interested' || prev.wasInterested;
    var at = Date.now();
    var retry = o === 'noanswer' || o === 'voicemail', wasRetry = prev.o === 'noanswer' || prev.o === 'voicemail';
    var tries = retry ? (changing && wasRetry ? (prev.tries || 1) : (prev.tries || 0) + 1) : prev.tries;
    S.log[l.id] = Object.assign({ o: o, box: pitchFor(l).id, at: at }, prev.email ? { email: prev.email } : {}, was && o !== 'interested' && !CLOSED[o] ? { wasInterested: true } : {},
      tries ? { tries: tries } : {}, extra || {});
    var last = -1; if (changing) for (var i = S.calls.length - 1; i >= 0; i--) { if (S.calls[i].id === l.id) { last = i; break; } }
    if (last >= 0) S.calls[last].o = o; else S.calls.push({ id: l.id, o: o, at: at });
    if (S.calls.length > 500) S.calls.shift(); save();
  }
  function commit(l, o, extra, changing, late) {
    var before = S.log[l.id] ? JSON.parse(JSON.stringify(S.log[l.id])) : null, callsBefore = JSON.parse(JSON.stringify(S.calls));
    record(l, o, extra, changing);
    var qid = DEMO ? null : queueCall(l, o, extra, changing);
    hideSheet(); setPending(null); tapGuard = performance.now() + 450; // 7: a quick second tap must not land on the card underneath
    buzz(o === 'won' ? [20, 40, 20] : 15);
    var card = cardEl(l.id);
    if (!card || !LEAD[l.id]) { if (qid) release(qid); if (card) { card.remove(); updateEnd(); } return; } // no card to undo on: send it now
    var fresh = renderCard(card), adv = null;
    var s = S.log[l.id], msg = statusText(s);
    var wb = o === 'won' && BOX[s.box] && BOX[s.box].earn ? BOX[s.box] : null, first = !changing && S.calls.length === 1;
    var nextEl = fresh.nextElementSibling, nextName = nextEl && LEAD[nextEl.getAttribute('data-id')] ? LEAD[nextEl.getAttribute('data-id')].name : '';
    var tail = late ? ' (too late for today)' : o === 'won' ? (wb ? ' · +' + money(wb.earn) + (period(wb) === 'quarter' ? '/qtr' : '/mo') + ' once they pay' : ' · send your link') : o === 'interested' ? ' · send your link' : first ? ' · first call done!' : '';
    showUndo(l.name + ': ' + msg + tail, l.id, before, null, callsBefore, qid);
    var pp = fresh.querySelector('.lead-meta .pill:not(.from)'); if (pp && !reduced) pp.classList.add('pop');
    if (o === 'won' || o === 'interested') {
      feedShow(fresh, true, true); var f = fresh.querySelector('[data-mail]');
      if (f) { f.focus({ preventScroll: true }); keepAboveUndo(fresh.querySelector('.won-btns') || f); }
    } else {
      var nx = fresh.querySelector('[data-next]'); if (nx) nx.focus({ preventScroll: true });
      if (!S.big) {
        U.adv = armAdvance(function () { var c = cardEl(l.id); if (c) goTo(c.nextElementSibling); }, 1500);
        if (nextName && !reduced) { undoEl.classList.remove('advancing'); void undoEl.offsetWidth; undoEl.classList.add('advancing'); }
      }
    }
  }

  /* the automatic move to the next business is cancelled by anything the partner does first */
  function armAdvance(fn, ms) {
    var t = setTimeout(done, ms), evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    function cancel() { if (performance.now() < tapGuard) return; clearTimeout(t); off(); undoEl.classList.remove('advancing'); }
    function done() { off(); undoEl.classList.remove('advancing'); fn(); }
    function off() { evs.forEach(function (e) { document.removeEventListener(e, cancel, true); }); var f = feedEl(); if (f) f.removeEventListener('scroll', cancel); }
    evs.forEach(function (e) { document.addEventListener(e, cancel, true); });
    setTimeout(function () { var f = feedEl(); if (f) f.addEventListener('scroll', cancel); }, 50);
    return { cancel: cancel };
  }
  function keepAboveUndo(el) {
    var f = feedEl(); if (!f || !el || undoEl.hidden) return;
    var u = undoEl.getBoundingClientRect(), r = el.getBoundingClientRect(), z = zoom();
    if (r.bottom > u.top - 12) f.scrollTo({ top: f.scrollTop + (r.bottom - u.top + 20) / z, behavior: 'instant' });
  }

  /* ---------- undo: every save can be taken back for a few seconds ---------- */
  var U = null, undoEl = document.getElementById('undo');
  function showUndo(text, id, before, adv, calls, qid) {
    clearTimeout(U && U.t);
    if (U && U.qid && U.qid !== qid) release(U.qid); // a newer save replaces the bar: the older result can go to Station now
    U = { id: id, before: before, adv: adv, calls: calls, qid: qid };
    document.getElementById('undoText').textContent = text;
    undoEl.hidden = false; undoEl.classList.add('on'); document.body.classList.add('has-undo');
    document.getElementById('undoKey').hidden = touch;
    U.t = setTimeout(hideUndo, 10000); sizeFeed();
  }
  function hideUndo() {
    if (U) { clearTimeout(U.t); if (U.adv) U.adv.cancel(); if (U.qid) release(U.qid); }
    undoEl.classList.remove('advancing');
    var id = U && U.id, had = undoEl.contains(document.activeElement), was = !undoEl.hidden;
    U = null; undoEl.hidden = true; undoEl.classList.remove('on'); document.body.classList.remove('has-undo'); if (was) sizeFeed();
    if (had && id) { var c = cardEl(id), h = c && c.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  }
  function holdUndo() { if (U) clearTimeout(U.t); }
  function releaseUndo() { if (U && !undoEl.contains(document.activeElement)) { clearTimeout(U.t); U.t = setTimeout(hideUndo, 5000); } }
  undoEl.addEventListener('focusin', holdUndo); undoEl.addEventListener('pointerenter', holdUndo);
  undoEl.addEventListener('focusout', function () { setTimeout(releaseUndo, 0); }); undoEl.addEventListener('pointerleave', releaseUndo);
  // 6: keyboard users can undo with U or Ctrl/Cmd+Z without tabbing all the way to the bar
  document.addEventListener('keydown', function (e) {
    if (!U || !sheet.hidden || /input|textarea|select/i.test(e.target.tagName)) return; // never while typing: an email can start with "u"
    if ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.metaKey && !e.altKey || (e.key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); document.getElementById('undoBtn').click(); }
  });
  document.getElementById('undoBtn').addEventListener('click', function (e) {
    if (!U || (e && e.isTrusted !== false && e.detail && performance.now() < tapGuard)) return;
    var u = U; if (u.qid) { dropQueued(u.qid); U.qid = null; } hideUndo(); if (u.adv) u.adv.cancel();
    if (u.before) S.log[u.id] = u.before; else delete S.log[u.id];
    S.calls = u.calls; // 4: put today's call list back exactly as it was, whether the save added a call or corrected one
    save();
    var card = cardEl(u.id); if (card) { var fresh = renderCard(card); goTo(fresh); }
    toast('Undone.');
  });

  document.addEventListener('keydown', function (e) {
    if (location.hash.indexOf('#calls') !== 0 || !sheet.hidden || TOUR || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    var k = e.key.toLowerCase(), cur = currentCard(); if (!cur || !/^[jklc]$/.test(k)) return;
    e.preventDefault();
    if (k === 'j') goTo(cur.nextElementSibling);
    else if (k === 'k') goTo(cur.previousElementSibling);
    else if (k === 'l') { var lg = cur.querySelector('[data-log]'); if (lg) lg.click(); }
    else { var cb = cur.querySelector('.call-btn:not([disabled])'); if (cb) cb.click(); }
  });

  /* ---------- pick a product for one business ---------- */
  function openPitchPicker(l) {
    var cur = pitchFor(l), list = PW.boxes.filter(sellable);
    function item(x) {
      var tags = (x.id === l.fits ? '<span class="badge first">Best fit here</span>' : '') + (x.id === cur.id ? '<span class="badge bundle">Pitching now</span>' : '');
      return '<button type="button" class="pick' + (x.id === cur.id ? ' on' : '') + '" data-pick="' + x.id + '"><span class="pick-name">' + esc(x.name) + ' ' + tags + '</span><span class="pick-what">' + esc(x.what) + '</span></button>';
    }
    var singles = list.filter(function (x) { return !x.bundle; }).sort(function (a, b) { return (a.id === l.fits ? -1 : 0) - (b.id === l.fits ? -1 : 0) || easyFirst(a, b); });
    openSheet('What to pitch ' + l.name, '<p class="sheet-sub">' + esc(l.gap) + '</p><p class="sheet-sub"><a href="#buyers">Not sure? See who buys and what works on each.</a></p><div class="picks">' + singles.map(item).join('') + '</div><h3 class="sheet-h">Collections and plans</h3><div class="picks">' + list.filter(function (x) { return x.bundle; }).map(item).join('') + '</div>');
    document.getElementById('sheetBody').addEventListener('click', function (e) {
      var p = e.target.closest('[data-pick]'); if (!p) return;
      S.pitch[l.id] = p.getAttribute('data-pick');
      if (S.log[l.id] && !CLOSED[S.log[l.id].o]) S.log[l.id].box = S.pitch[l.id];
      save(); hideSheet();
      var card = cardEl(l.id); if (card) { var fresh = renderCard(card); var ch = fresh.querySelector('[data-pitch]'); if (ch) ch.focus(); }
      toast('Pitching ' + BOX[S.pitch[l.id]].name + ' here.');
    });
  }

  /* ---------- first visit to Calls: a 4-step tour of the first card ---------- */
  var TOUR = null;
  function startTour() {
    var card = feedEl() && feedEl().querySelector('.lead[data-id]'); if (!card || location.hash.indexOf('#calls') !== 0 || !sheet.hidden) return;
    TOUR = { i: 0, steps: [
      [card.querySelector('h2'), 'This is 1 of your ' + LEADS.length + ' businesses. Each one is yours for ' + holdDays() + ' days, and every call you log keeps it longer; the date is on the tag above it.'],
      [card.querySelector('.pitch-box'), 'What to pitch them, and what to say after you say who you are. Tap Change to pitch something else.'],
      [card.querySelector('.call-btn'), 'Tap to call. Your lines show before the phone opens.'],
      [card.querySelector('[data-log]'), 'When you hang up, tell the app how it went. You can undo any mistake.']
    ].filter(function (s) { return s[0]; }) };
    document.getElementById('coach').hidden = false; main.inert = true; showStep();
  }
  function showStep() {
    var s = TOUR.steps[TOUR.i], el = s[0], ring = document.getElementById('coachRing'), bub = document.getElementById('coachBubble');
    feedShow(el, false, true);
    var z = zoom(), b0 = el.getBoundingClientRect(), r = { top: b0.top / z, left: b0.left / z, width: b0.width / z, height: b0.height / z, bottom: b0.bottom / z };
    ring.style.cssText = 'top:' + (r.top - 8) + 'px;left:' + (r.left - 8) + 'px;width:' + (r.width + 16) + 'px;height:' + (r.height + 16) + 'px';
    document.getElementById('coachStep').textContent = (TOUR.i + 1) + ' of ' + TOUR.steps.length;
    document.getElementById('coachText').textContent = s[1];
    document.getElementById('coachNext').textContent = TOUR.i === TOUR.steps.length - 1 ? 'Got it' : 'Next';
    var below = r.bottom + 16, h = bub.offsetHeight || 150, vh = window.innerHeight / z;
    bub.style.top = (below + h < vh - 8 ? below : Math.max(8, r.top - h - 16)) + 'px';
    document.getElementById('coachNext').focus();
  }
  function endTour() { if (!TOUR) return; TOUR = null; document.getElementById('coach').hidden = true; main.inert = false; S.toured = true; save(); var f = feedEl(); if (f) f.scrollTo({ top: 0, behavior: 'instant' }); }
  function focusFirstCard() { var h = feedEl() && feedEl().querySelector('.lead[data-id] h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  document.getElementById('coachNext').addEventListener('click', function () { if (!TOUR) return; if (TOUR.i < TOUR.steps.length - 1) { TOUR.i++; showStep(); } else { endTour(); focusFirstCard(); } });
  document.getElementById('coachSkip').addEventListener('click', function () { endTour(); focusFirstCard(); });
  document.addEventListener('keydown', function (e) {
    if (!TOUR) return;
    if (e.key === 'Escape') { endTour(); focusFirstCard(); return; }
    if (e.key === 'Tab') { e.preventDefault(); var a = document.getElementById('coachSkip'), n = document.getElementById('coachNext'); (document.activeElement === n ? a : n).focus(); }
  });

  /* ---------- sheets; focus stays inside while open ---------- */
  var lastFocus = null, sheet = document.getElementById('sheet');
  var ignorePop = false;
  function openSheet(title, html) {
    if (sheet.hidden) { lastFocus = document.activeElement; try { history.pushState({ pwSheet: 1 }, '', location.href); } catch (e) {} }
    var old = document.getElementById('sheetBody'), nb = old.cloneNode(false); old.parentNode.replaceChild(nb, old); // drop old listeners
    var st = document.getElementById('sheetTitle'); st.textContent = title; nb.innerHTML = html;
    sheet.hidden = false; st.setAttribute('tabindex', '-1'); st.focus({ preventScroll: true });
  }
  function openScript(b) {
    openSheet(b.name + ': what to say', '<p class="small">Suggested words. Say it your way, and keep the facts and the rules.</p>' + sayBoxes(script(b), true) + '<h3 class="sheet-h">If they push back</h3>' + (repliesBlock(b) || '<p>Answer the question, then offer to send the link.</p>') +
      (b.brand === 'station' ? '<h3 class="sheet-h">Other good questions</h3><ul class="ticks">' + PW.qualify.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' : ''));
  }
  function openGlossary() { openSheet('What the buttons mean', glossaryHtml()); }
  function glossaryHtml() {
    return ('<dl class="gloss">' +
      '<dt>No answer, Voicemail</dt><dd>You couldn’t reach them. They stay on your list and come back tomorrow.</dd>' +
      '<dt>Bad lead</dt><dd>Wrong number, closed down, or not a business that could use it. Station takes it back.</dd>' +
      '<dt>Talked to them</dt><dd>You spoke to someone. Then pick how it went.</dd>' +
      '<dt>Interested</dt><dd>They want to hear more. They stay on your list.</dd>' +
      '<dt>Call back</dt><dd>They asked you to call another day. Pick when; on that day they move to the top of your list.</dd>' +
      '<dt>Not interested</dt><dd>They said no. That business is finished.</dd>' +
      '<dt>Do not call</dt><dd>They asked you to stop. Nobody calls that business again, and the call button goes away.</dd>' +
      '<dt>Won</dt><dd>They’re buying. Send them your link; Station checks it and sets them up.</dd>' +
      '<dt>Undo</dt><dd>Tapped the wrong one? Press Undo at the bottom of the screen right after you save.</dd>' +
      '<dt>Tried today</dt><dd>After No answer or Voicemail, a business comes back tomorrow. Nobody gets called twice in one day.</dd>' +
      '<dt>Yours until</dt><dd>Every business is yours for ' + holdDays() + ' days, and every call you log on it restarts the ' + holdDays() + ' days. If ' + holdDays() + ' days go by without a call, it goes back to Station’s shared list.</dd></dl>');
  }
  function hideSheet() {
    if (sheet.hidden) return;
    if (!reduced) { // a copy of the sheet slides away while the real one is already gone (state stays instant)
      var g = sheet.cloneNode(true); g.removeAttribute('id'); g.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
      g.classList.add('ghost'); g.setAttribute('aria-hidden', 'true'); g.inert = true; document.body.appendChild(g);
      setTimeout(function () { g.remove(); }, 220);
    }
    sheet.hidden = true;
    if (history.state && history.state.pwSheet) { ignorePop = true; history.back(); }
  }
  function closeSheet() { hideSheet(); setPending(null); tapGuard = performance.now() + 450; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    if (!sheet.hidden) { sheet.hidden = true; setPending(null); if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); } // Back is not a tap: no tap guard
  });
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function (e) {
    if (sheet.hidden) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (/^[1-4]$/.test(e.key) && !/input|textarea|select/i.test(e.target.tagName)) { // keys 1-4 pick the first row of outcomes
      var ob = sheet.querySelectorAll('[data-row="1"] [data-o]')[+e.key - 1]; if (ob) { e.preventDefault(); ob.click(); } return;
    }
    if (e.key !== 'Tab') return;
    var f = [].filter.call(sheet.querySelectorAll('button, summary, a[href], input'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- LIVE money: the engine's money lines (what cleared, what's held, what's paid) and the two setup steps ---------- */
  function cents(n) { return money((+n || 0) / 100); }
  function liveClients() {
    var out = '', lines = ((MONEY && MONEY.lines) || []).slice(0, 30); // the engine's own order (installments stay in sequence)
    var waiting = LEADS.filter(function (l) { var s = S.log[l.id]; return s && s.o === 'won' && !s.accepted; });
    if (!MONEY) out += '<p class="empty">' + esc(MONEY_ERR || 'Your money couldn’t load just now.') + ' Your records are safe at Station. <button class="link-btn" type="button" id="moneyRetry">Try again</button></p>';
    if (lines.length) out += '<div class="table-wrap"><table><thead><tr><th scope="col">Client</th><th scope="col">On</th><th scope="col" class="r">They paid</th><th scope="col" class="r">You earn</th><th scope="col">Where it stands</th></tr></thead><tbody>' +
      lines.map(function (x) {
        return '<tr><td data-l="Client"><b>' + esc(x.client || 'A client') + '</b></td><td data-l="On">' + esc(x.product || '') + '</td><td data-l="They paid" class="r num">' + (x.basis_cents == null ? '—' : cents(x.basis_cents)) + '</td>' +
          '<td data-l="You earn" class="r num">' + cents((+x.amount_cents || 0) - (+x.reversed_cents || 0)) + '</td><td data-l="Where it stands">' + esc(x.status_text || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (waiting.length) out += '<h3 class="sheet-h">Wins Station is checking</h3><p class="small">You marked these Won. Station confirms each one and sets the client up; you earn once they pay.</p><ul class="ticks">' +
      waiting.map(function (l) { return '<li>' + esc(l.name) + '</li>'; }).join('') + '</ul>';
    if (MONEY && !lines.length && !waiting.length) out += '<p class="empty">No clients yet. When a business you called starts paying Station, it shows up here.</p>';
    return out;
  }
  function setupLive() {
    if (!MONEY) return '';
    var tf = (ME && ME.taxform) || {}, tax = !!MONEY.tax_received, taxWait = !tax && !!(tf.pending_review || tf.uploaded_at || tf.uploadedAt);
    var st = MONEY.account_state || 'none', steps = (tax ? 0 : 1) + (st === 'ready' ? 0 : 1);
    var taxRow = tax ? '<span class="done-mark">✓ Received</span>'
      : '<span class="tax-pick"><button class="btn" type="button" data-act="tax">' + (taxWait ? 'Upload a different one' : 'Upload my tax form') + '</button><input type="file" id="taxFile" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden></span>';
    var needs = Array.isArray(MONEY.account_needs) && MONEY.account_needs.length && st !== 'ready' ? ' Stripe still needs: ' + MONEY.account_needs.map(function (x) { return esc(String(x).replace(/[._]/g, ' ')); }).join(', ') + '.' : '';
    var payRow = st === 'ready' ? '<span class="done-mark">✓ Ready</span>' : st === 'review' ? '<span class="small">Stripe is checking your details.</span>'
      : '<button class="btn" type="button" data-act="stripe">' + (st === 'setup' ? 'Finish setting up payouts' : 'Set up payouts with Stripe') + '</button>';
    return '<div class="setup"><h2 class="setup-h">' + (steps ? steps + (steps === 1 ? ' step' : ' steps') + ' before Station can pay you' : 'You’re set up to be paid') + '</h2>' +
      '<div class="setup-row"><span><b>1. Your tax form.</b> ' + (tax ? 'Station has your tax form.' : taxWait ? 'Uploaded. Station is checking it.' : 'IRS Form W-9. Upload it here instead of emailing it: it carries your Social Security number. PDF, JPG or PNG, under 5 MB. Outside the U.S.? Email Station before you start.') +
      ' Station issues a 1099 where the law requires; your taxes are your own.</span>' + taxRow + '</div>' +
      '<div class="setup-row"><span><b>2. Your payout account.</b> Station pays you through Stripe. You type your bank details on Stripe’s own site; Station never sees them.' + needs + '</span>' + payRow + '</div></div>';
  }
  function earnedNote(t) {
    if (DEMO) return 'No commission yet. Paid in the first payout after the 2 steps below are done.';
    if (t.unknown) return 'Couldn’t load just now. Your money is safe at Station.';
    var b = (MONEY.totals && MONEY.totals.blockers) || [], min = (MONEY.min_cents || 5000) / 100;
    if (t.ready && b.length) return 'Ready, and paid in the first payout after the setup steps below are done.';
    if (t.ready && t.ready < min) return 'Paid once ' + money(min) + ' or more is ready. Smaller amounts roll forward.';
    if (t.ready) return 'Ready. Payouts go out every two weeks.';
    return 'No commission ready yet. It shows here once a client’s payment clears and any hold ends.';
  }
  /* uploads and payout setup write to Station too, so they never run while the queue is sending */
  function oneWrite(action, body, btn, label, then) {
    if (pumping) { toast('Saving your last results first. Try again in a moment.', 4000); return; }
    pumping = true; btn.disabled = true; var was = btn.textContent; btn.textContent = label;
    api(action, body).then(function (d) {
      pumping = false; btn.disabled = false; btn.textContent = was; pump();
      if (d.signedOut) return;
      if (d.ok !== true) { toast(action === 'taxform_submit' && /email/i.test(String(d.error || '')) ? 'The upload didn’t go through. Try again in a few minutes; if it still fails, email main@station.solutions to ask for a safe way to send it. Don’t attach the form to an email.' : sentence(d.error, 'Station couldn’t take that just now.'), 8000); return; }
      then(d);
    }, function () { pumping = false; btn.disabled = false; btn.textContent = was; pump(); toast('No connection to Station. Try again in a moment.', 5000); });
  }
  function wireMoneyLive() {
    var mr = document.getElementById('moneyRetry');
    if (mr) mr.addEventListener('click', function () {
      mr.disabled = true;
      api('money_lines').then(function (x) { MONEY = x && x.ok !== false ? x : null; MONEY_ERR = x && x.ok === false ? sentence(x.error, '') : ''; VIEWS.money(); }, function () { mr.disabled = false; toast('Still no connection to Station.', 4000); });
    });
    var tb = main.querySelector('[data-act="tax"]'), tfile = document.getElementById('taxFile');
    if (tb) tb.addEventListener('click', function () { tfile.value = ''; tfile.click(); });
    if (tfile) tfile.addEventListener('change', function () {
      var f = tfile.files && tfile.files[0]; if (!f) return;
      var type = (f.type || '').toLowerCase();
      if (['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].indexOf(type) < 0) { toast('Your tax form needs to be a PDF, JPG or PNG.', 5000); return; }
      if (f.size > 5 * 1024 * 1024) { toast('That file is over 5 MB. A phone photo or a PDF scan is usually smaller.', 5000); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var data = String(rd.result || ''), comma = data.indexOf(',');
        oneWrite('taxform_submit', { type: 'W-9', filename: f.name, mimetype: type, filedata: comma >= 0 ? data.slice(comma + 1) : data }, tb, 'Uploading…', function () {
          if (ME) { ME.taxform = Object.assign({}, ME.taxform || {}, { pending_review: true }); }
          VIEWS.money(); toast('Uploaded. Station will check it.', 4000);
        });
      };
      rd.onerror = function () { toast('That file couldn’t be read. Try another.', 4000); };
      rd.readAsDataURL(f);
    });
    var sb = main.querySelector('[data-act="stripe"]');
    if (sb) sb.addEventListener('click', function () {
      oneWrite('payout_link', {}, sb, 'Opening Stripe…', function (d) { if (d.url && /^https:\/\//.test(d.url)) location.href = d.url; else toast('Stripe didn’t send a link. Try again in a moment.', 5000); });
    });
  }

  /* ---------- money ---------- */
  VIEWS.money = function () {
    chrome(true, 'money');
    var t = totals(), ex = exampleTotals();
    var won = Object.keys(S.log).filter(function (k) { return S.log[k].o === 'won' && LEAD[k]; }).map(function (k) {
      var bx = BOX[S.log[k].box]; return { client: LEAD[k].name, on: bx ? bx.name : '', earn: bx && bx.earn, per: bx ? period(bx) : 'month' };
    });
    var mine = !DEMO ? liveClients() : won.length ? '<div class="table-wrap"><table><thead><tr><th scope="col">Client</th><th scope="col">On</th><th scope="col" class="r">You’ll earn</th><th scope="col">Where it stands</th></tr></thead><tbody>' +
      won.map(function (w) { return '<tr><td data-l="Client"><b>' + esc(w.client) + '</b></td><td data-l="On">' + esc(w.on) + '</td><td data-l="You’ll earn" class="r num">' + (w.earn ? money(w.earn) + (w.per === 'quarter' ? ' a quarter' : ' a month') : '40% of their care plan') + '</td><td data-l="Where it stands">Won in your calls. Station checks it; you earn once they pay.</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p class="empty">No clients yet. When a business you called starts paying Station, it shows up here.</p>';
    var rows = BOOK.map(function (r) { return '<tr><td data-l="Client"><b>' + esc(r.client) + '</b></td><td data-l="On">' + esc(r.on) + '</td><td data-l="They pay" class="r num">' + money(r.pays) + ' a month</td><td data-l="You earn" class="r num">' + money(r.pays * PW.rate) + ' a month</td><td data-l="Where it stands">' + esc(r.state) + '</td></tr>'; }).join('');
    mount('<div class="wrap money"><h1>Your money</h1><p class="sub">' + (DEMO ? 'Once you’re live, these numbers come from Station’s payment records, and those records decide what you’re paid.' : 'From Station’s payment records, which decide what you’re paid.') + '</p>' +
      '<div class="tiles3"><div class="tile hero"><span class="lbl">Earned</span><div class="v num">' + (t.unknown ? '—' : money(t.ready)) + '</div><p>' + earnedNote(t) + '</p></div>' +
      '<div class="tile"><span class="lbl">On hold</span><div class="v num">' + (t.unknown ? '—' : money(t.hold)) + '</div><p>Station may hold a new client’s first payment up to 30 days after it clears (the refund window).</p></div>' +
      '<div class="tile"><span class="lbl">Paid to date</span><div class="v num">' + (t.unknown ? '—' : money(t.paid)) + '</div><p>Payouts go out every two weeks once $50 or more is ready.</p></div></div>' +
      (DEMO ? '<div class="setup"><h2 class="setup-h">2 steps before Station can pay you</h2>' +
      '<div class="setup-row"><span><b>1. Your tax form.</b> U.S. partners: IRS Form W-9 (outside the U.S.: W-8BEN). Upload it here, never by email: it carries your Social Security number. Station issues a 1099 where the law requires; your taxes are your own.</span><button class="btn" type="button" data-demo="tax">Upload my tax form</button></div>' +
      '<div class="setup-row"><span><b>2. Your payout account.</b> Station pays you through Stripe. You type your bank details on Stripe’s own site; Station never sees them.</span><button class="btn" type="button" data-demo="stripe">Set up payouts with Stripe</button></div></div>' : setupLive()) +
      '<h2>Your clients</h2>' + mine +
      '<section class="example" aria-labelledby="exH"><h2 id="exH">Example: this page with two paying clients</h2><p class="small">Sample figures to show how it works. Not your money, and not a forecast.</p>' +
      '<div class="ex-sum"><span>Earned <b class="num">' + money(ex.ready) + '</b></span><span>On hold <b class="num">' + money(ex.hold) + '</b></span></div>' +
      '<div class="table-wrap"><table><thead><tr><th scope="col">Client</th><th scope="col">On</th><th scope="col" class="r">They pay</th><th scope="col" class="r">You earn</th><th scope="col">Where it stands</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<h2 class="gap-h">From a yes to your first payout</h2>' + yesToPaid() +
      '<h2 class="gap-h">What one paying client is worth</h2>' + worthTable() +
      '<h2 class="gap-h">How you get paid</h2><div class="howpay">' +
      '<div><b>40% of every monthly payment</b>For as long as the client keeps paying and your agreement is in effect.</div>' +
      '<div><b>After the free trial</b>Every single product and every collection starts with a ' + TD + '-day trial. You earn from their first real payment. Core, Pro, Max and custom websites have no trial.</div>' +
      '<div><b>Every two weeks</b>Paid to your Stripe account once $50 or more is ready. Smaller amounts roll forward and never expire.</div>' +
      '<div><b>Monthly fees only</b>Website build fees and the one-time $500 to keep a built site earn nothing, and neither does a free website. The monthly price behind them does.</div>' +
      '<div><b>Refunds and chargebacks</b>If a client’s payment is refunded or reversed, that commission comes off your balance or next payout. If there’s no balance left, Station may invoice you for it.</div>' +
      '<div><b>If a client cancels</b>Your commission on them stops when they stop paying. What you’ve already earned stays yours.</div>' +
      '<div><b>If the agreement ends</b>Either side can end it any time by email. You’re paid on payments that cleared up to that day, and nothing after.</div>' +
      '<div><b>Something looks wrong?</b>Tell Station in writing within 60 days. Station’s payment records decide.</div></div>' +
      '<p class="small fine">The main points of the Station Partner Agreement.</p></div>', 'Money');
    main.querySelectorAll('[data-demo]').forEach(function (x) { x.addEventListener('click', function () { toast(x.getAttribute('data-demo') === 'tax' ? 'Signed in, this opens a secure upload.' : 'Signed in, this opens your own Stripe setup.'); }); });
    if (!DEMO) wireMoneyLive();
  };

  /* ---------- founder view (preview): loaded on demand from admin.js ---------- */
  if (/[?&]embed\b/.test(location.search)) document.documentElement.classList.add('embed');
  VIEWS.admin = function () {
    chrome(true, 'admin');
    function go() { window.PW_ADMIN(mount, toast); }
    if (window.PW_ADMIN) { go(); return; }
    main.innerHTML = '<div class="wrap admin"><p class="small">Loading the founder view…</p></div>';
    var sc = document.createElement('script'); sc.src = 'admin.js?v=1'; sc.onload = function () { if (location.hash === '#admin') go(); };
    sc.onerror = function () { main.innerHTML = '<div class="wrap admin"><p>The founder view couldn’t load. Check your connection and reload.</p></div>'; };
    document.head.appendChild(sc);
  };


  /* ---------- who buys: ten real buyers and the habits that win them (words live in buyers.py) ---------- */
  var BUYER = {}; (PW.buyers || []).forEach(function (y) { BUYER[y.id] = y; });
  function buyerRow(label, body, say) { return '<div class="cheat-row' + (say ? ' is-say' : '') + '"><span class="cheat-lbl">' + label + '</span><p>' + esc(body) + '</p></div>'; }
  VIEWS.buyers = function (id) {
    chrome(true, 'products');
    var y = BUYER[id];
    if (id && !y) { location.replace('#buyers'); return; }
    if (y) {
      var fit = BOX[y.fit];
      mount('<div class="wrap prod"><a class="back" href="#buyers">&larr; All buyers</a>' +
        '<div class="prod-top"><h1>' + esc(y.name) + ', ' + y.age + '</h1><p class="what">' + esc(y.line) + '</p></div>' +
        '<section class="cheat" aria-labelledby="cheatH"><h2 id="cheatH">How to talk to ' + esc(y.name) + '</h2>' +
        buyerRow('Probably feeling (for you, not to say out loud)', y.feels) + buyerRow('Ask first', y.ask, 1) + buyerRow('Then say', y.say, 1) +
        buyerRow('The push-back: ' + y.worry, y.reply, 1) + buyerRow('Don’t', y.avoid) +
        '<div class="cheat-row"><span class="cheat-lbl">Best fit</span><p><a href="#box/' + y.fit + '"><b>' + esc(y.fitNote) + '</b></a></p></div>' +
        (fit && fit.earn ? '<div class="cheat-row"><span class="cheat-lbl">What you earn</span><p>' + esc(fit.short || fit.name) + ' pays you ' + money(fit.earn) + ' a month per paying client. You earn 40% of whatever they pay Station.</p></div>' : '') +
        '<div class="cheat-row"><span class="cheat-lbl">Sounds like these businesses</span><p>' + esc(y.trades) + '</p></div>' +
        '<p class="small fine">Suggested words. Say it your way, and keep the facts and the rules.</p></section></div>' +
        '<div class="cta-bar"><a class="btn btn-dark btn-big" href="#box/' + y.fit + '">See the ' + esc(fit ? fit.short || fit.name : 'product') + ' cheat sheet</a></div>', y.name);
      return;
    }
    mount('<div class="wrap prod"><a class="back" href="#products">&larr; All products</a>' +
      '<div class="prod-top"><h1>Who buys</h1><p class="what">Ten kinds of owner, what each one is probably feeling when you call, and words that work. People buy a fix for a problem they already feel, not a product.</p></div>' +
      '<h2 class="sub-h">Ten buyers</h2><div class="grid">' + (PW.buyers || []).map(function (b) {
        return '<a class="box" href="#buyers/' + b.id + '"><span class="name">' + esc(b.name) + ', ' + b.age + '</span><span class="what">' + esc(b.line) + '</span><span class="fitline"><b>Best fit:</b> ' + esc(b.fitNote) + '</span><span class="trades">Like: ' + esc(b.trades) + '</span></a>';
      }).join('') + '</div>' +
      '<h2 class="sub-h">' + (PW.playbook || []).length + ' habits that win the call</h2><div class="more-list">' + (PW.playbook || []).map(function (h, i) {
        return '<details class="acc"><summary>' + (i + 1) + '. ' + esc(h.t) + '</summary><div><p>' + esc(h.why) + '</p><div class="say"><small>Say</small>' + esc(h.say.replace(/\[your name\]/g, S.name)) + '</div><div class="dont"><b>Don’t</b> ' + esc(h.never) + '</div></div></details>';
      }).join('') + '</div></div>', 'Who buys');
  };

  /* ---------- help ---------- */
  VIEWS.help = function () {
    chrome(true, 'help');
    mount('<div class="wrap help"><h1>Help</h1>' +
      '<h2>Stuck on something?</h2><p>Email Station at <a href="mailto:main@station.solutions">main@station.solutions</a>. Station replies by email. Station doesn’t have a phone line, so never give out a number for Station.</p>' +
      '<h2>Who Station is</h2><p>Station Automations Group LLC, based in Houston, Texas. Every product and price is published at station.solutions. You’re an independent partner: you choose when and how you work, there’s no quota, and you earn a flat 40% with no tiers or bonuses. The Station Partner Agreement wins over anything in this app.</p>' +
      '<h2>Easier to read</h2><p>Make all the text bigger on this device.</p><button class="btn" type="button" data-size aria-pressed="' + !!S.big + '">Bigger text on or off</button>' +
      '<h2>The rules, in one breath</h2><ul class="ticks">' +
      '<li>You’re an independent partner. Say so if anyone asks.</li><li>Never change a price, offer a deal or share your commission.</li>' +
      '<li>Never promise results, a ranking or a go-live date. Anything that texts waits about 2 business days on the carriers.</li>' +
      '<li>Call businesses 9 am to 8 pm, Monday to Saturday, their time. Dial each business yourself, once a day at most. Leaving a voicemail is fine: tap Voicemail? on the card for the line.</li>' +
      '<li>Each business is yours for ' + holdDays() + ' days from the day Station sends it, or from the last call you logged on it. After that it goes back to Station’s shared list.</li>' +
      '<li>If anyone says “take me off your list,” say sorry, end the call and mark them Do not call.</li>' +
      '<li>Never record a call, and never text or email a business unless they ask you to.</li>' +
      '<li>Your link is what credits a sale to you, so send it every time. Log every call too: Station’s records decide who gets credit.</li>' +
      '<li>Don’t copy leads or client details into your own spreadsheet or CRM, and never ask a business to send you their customer list.</li></ul>' +
      '<h2>How a call works</h2><p>Tap <b>Call now</b>, put it on speaker somewhere private, and read your lines. When you come back to the app, tap how it went. Pressed the wrong button? Tap <b>Undo</b>.</p>' +
      '<div class="help-btns"><button class="btn" type="button" id="tourBtn">Show me the tour again</button><button class="btn" type="button" id="glossBtn">What the buttons mean</button>' +
      (S.skipPrep ? '<button class="btn" type="button" id="prepBtn">Show the “Ready to call” card again</button>' : '') + '</div>' +
      '<h2>Your 30-second pitch for Station</h2><div class="say">' + esc(PW.pitch) + '</div>' +
      '<h2>How people decide</h2><p>Ten kinds of buyer and the habits that win the call.</p><a class="btn" href="#buyers">See who buys</a>' +
      '<h2>Take the check again</h2><p>Six questions, one minute.</p><a class="btn" href="#check">Retake the check</a>' +
      (DEMO ? '<h2>Start over</h2><p>Clears your name and the calls you logged in this preview, on this device only.</p><button class="btn" type="button" id="reset">Reset the preview</button>'
        : '<h2>Your account</h2><p>Signed in as <b>' + esc((ME && ME.name) || S.name) + '</b>, partner code <b>' + esc(S.code) + '</b>. Same account as the Station partner portal.</p><button class="btn" type="button" id="signOut">Sign out</button>') + '</div>', 'Help');
    document.getElementById('glossBtn').addEventListener('click', openGlossary);
    document.getElementById('tourBtn').addEventListener('click', function () { S.toured = false; save(); location.hash = '#calls'; });
    var pb = document.getElementById('prepBtn'); if (pb) pb.addEventListener('click', function () { S.skipPrep = false; save(); pb.remove(); toast('You’ll see the card before each call.'); });
    var so = document.getElementById('signOut');
    if (so) so.addEventListener('click', function () {
      flushNotes(); var n = S.outbox.length;
      if (n && so.getAttribute('data-armed') !== '1') { so.setAttribute('data-armed', '1'); so.textContent = n + (n === 1 ? ' save hasn’t' : ' saves haven’t') + ' reached Station yet, and signing out deletes ' + (n === 1 ? 'it' : 'them') + ' from this browser. Tap again to sign out anyway.'; return; }
      so.disabled = true; var done = function () { signedOut('You’re signed out.', true); };
      api('logout').then(done, done);
    });
    var r = document.getElementById('reset'), armed = null;
    if (r) r.addEventListener('click', function () {
      if (!armed) { r.textContent = (touch ? 'Tap' : 'Click') + ' again to reset'; armed = setTimeout(function () { armed = null; r.textContent = 'Reset the preview'; }, 4000); return; }
      clearTimeout(armed); try { localStorage.removeItem(KEY); } catch (e) {} S = fresh(); applySize(); if (location.hash) location.hash = ''; else route();
    });
  };

  window.addEventListener('hashchange', route);
  if (!DEMO && TOKEN) startLive(); else route();
  if (savedCall && LEAD[savedCall.id] && Date.now() - savedCall.at < 30 * 60e3 && location.hash.indexOf('#calls') === 0) openCallSheet(LEAD[savedCall.id], 'during');
})();
