/* Partner World (UI preview). Every Station fact comes from window.PW (built from the live partner guide and product list,
   with Partner World's script corrections from script_fixes.py).
   Leads, clients and money here are SAMPLE data: fictional businesses with reserved 555-01xx numbers, labelled on screen. */
(function () {
  'use strict';
  var PW = window.PW, KEY = 'pw-preview-v2';
  var main = document.getElementById('main');
  var BOX = {}; PW.boxes.forEach(function (b) { BOX[b.id] = b; });
  function fresh() { return { name: '', code: '', entered: false, log: {}, notes: {}, lastBox: 'lineback', filter: 'all', asked: false }; }

  /* ---------- state (this browser only; a preview has no account) ---------- */
  var S = fresh();
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (!S.notes) S.notes = {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- demo link: ?demo skips the welcome form and the check (optional &name=Linda, &code=lsmith) ---------- */
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.has('demo')) return;
    var name = (q.get('name') || '').trim().slice(0, 40), c = (q.get('code') || '').trim().toLowerCase();
    if (name) S.name = name; else if (!S.name) S.name = 'Sam';
    if (/^[a-z0-9-]{2,30}$/.test(c)) S.code = c; else if (!S.code) S.code = 'demo';
    S.entered = true; save();
    history.replaceState(null, '', location.pathname + (location.hash && location.hash !== '#' ? location.hash : '#home'));
  })();

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function toast(t) {
    var el = document.getElementById('toast'), f = document.getElementById('feed');
    el.style.top = f && window.innerWidth <= 760 ? Math.round(f.getBoundingClientRect().top + 8) + 'px' : '';
    el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2000); }
  function code() { return (S.code || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); }
  function brandName(id) { return ({ station: 'Station', ribbon: 'Ribbon Leads', quorum: 'Quorum' })[id]; }
  function perMonth(b) { return b.id === 'revive' ? b.earn / 3 : b.earn; }
  function period(b) { return b.id === 'revive' ? 'quarter' : 'month'; }
  function usable(b) { return b && !b.soon ? b : BOX.lineback; }
  function linkFor(b) { return b.link.replace('{code}', code()); }
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function copy(text, btn) {
    function done(ok) { if (btn) { var o = btn.getAttribute('data-label') || btn.textContent; btn.setAttribute('data-label', o); btn.textContent = ok ? 'Copied' : 'Select and copy'; setTimeout(function () { btn.textContent = o; }, 1800); } }
    try { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
  }

  /* ---------- dates (the partner's own calendar) ---------- */
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function today() { return ymd(new Date()); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return ymd(d); }
  function dayLabel(s) {
    if (s === today()) return 'today';
    if (s === ymd(new Date(Date.now() + 864e5))) return 'tomorrow';
    return new Date(s + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /* ---------- sample leads: fictional businesses, reserved 555-01xx numbers with real area codes ---------- */
  var LEADS = [
    ['s1', 'Bayou City Plumbing Co.', 'Plumbing', 'Houston', 'TX', '713', 4.6, 23, 'Answers their own phone; the listing says “call for same-day service.”', 'lineback'],
    ['s2', 'Red River Roofing', 'Roofing', 'Tulsa', 'OK', '918', 4.8, 61, 'Storm season. Lots of calls come in while crews are on roofs.', 'frontdesk'],
    ['s3', 'Magnolia Home Cleaning', 'House cleaning', 'Katy', 'TX', '281', 4.9, 14, 'Great rating, only 14 reviews.', 'repute'],
    ['s4', 'Lone Star HVAC Service', 'HVAC', 'Sugar Land', 'TX', '281', 4.4, 38, 'No online booking; “call us to schedule.”', 'slate'],
    ['s5', 'Prairie Fitness Studio', 'Gym', 'Norman', 'OK', '405', 4.7, 52, 'Books classes by phone and text.', 'slate'],
    ['s6', 'Gulf Breeze Pest Control', 'Pest control', 'Pasadena', 'TX', '713', 4.2, 19, 'Their website looks years out of date and is hard to use on a phone.', 'website'],
    ['s7', 'Cedar Bend Auto Glass', 'Auto glass', 'Round Rock', 'TX', '512', 4.8, 9, 'Nine reviews; a nearby competitor has over a hundred.', 'repute'],
    ['s8', 'Summit Electric LLC', 'Electrician', 'Edmond', 'OK', '405', 4.5, 27, 'Owner-operator; personal cell number on the listing.', 'dial'],
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
      phone: '(' + r[5] + ') 555-' + last, dial: '+1' + r[5] + '555' + last, days: 28 - Math.floor(i * 1.4) };
  });
  var LEAD = {}; LEADS.forEach(function (l) { LEAD[l.id] = l; });
  var TZ = { TX: 'America/Chicago', OK: 'America/Chicago' };

  function localTime(st) {
    var tz = TZ[st], now = new Date(), p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    var h = +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now) % 24;
    var sun = p.weekday === 'Sun', ok = !sun && h >= 9 && h < 20, why = '', opens = '';
    if (sun) { why = 'No calls on Sundays'; opens = 'Monday at 9 am'; }
    else if (h < 9) { why = 'Too early to call'; opens = 'today at 9 am'; }
    else if (h >= 20) { why = 'Too late to call'; opens = p.weekday === 'Sat' ? 'Monday at 9 am' : 'tomorrow at 9 am'; }
    return { text: p.hour + ':' + p.minute + ' ' + p.dayPeriod.toLowerCase(), ok: ok, why: why, opens: opens, sun: sun, early: !sun && h < 9 };
  }

  /* ---------- lead status ----------
     Follow-ups (No answer, Voicemail, Interested, Call back) stay on the list. Only a closed outcome finishes a lead,
     and a finished lead can't be called from the app. Order: call-backs due today, new, to try again, finished. */
  var OUT = { noanswer: 'No answer', voicemail: 'Voicemail', bad: 'Bad lead', interested: 'Interested', callback: 'Call back', notint: 'Not interested', dnc: 'Do not call', won: 'Won' };
  var CLOSED = { bad: 1, notint: 1, dnc: 1, won: 1 };
  function rank(l) {
    var s = S.log[l.id];
    if (!s) return 1;
    if (CLOSED[s.o]) return 3;
    if (s.o === 'callback' && s.due && s.due <= today()) return 0;
    return 2;
  }
  function counts() {
    var c = { due: 0, fresh: 0, again: 0, done: 0 };
    LEADS.forEach(function (l) { c[['due', 'fresh', 'again', 'done'][rank(l)]]++; });
    c.toCall = c.due + c.fresh + c.again; return c;
  }
  function statusText(s) {
    var t = s.o === 'callback' && s.due ? (s.due < today() ? 'Call back: overdue since ' + dayLabel(s.due) : 'Call back ' + dayLabel(s.due)) : OUT[s.o];
    return s.wasInterested && !CLOSED[s.o] ? 'Interested \u00b7 ' + t : t;
  }
  function callsSummary(c) {
    var parts = [];
    if (c.due) parts.push(c.due + (c.due === 1 ? ' call-back' : ' call-backs') + ' due');
    if (c.fresh) parts.push(c.fresh + ' new');
    if (c.again) parts.push(c.again + ' to try again');
    return parts.join(', ');
  }

  /* ---------- sample money: two fictional clients (not in the lead list) ---------- */
  var BOOK = [
    { client: 'Juniper Lane Plumbing (sample)', on: 'Lineback', pays: 197, earned: true, state: 'Earned. Paid after your tax form and payout setup are done.' },
    { client: 'Two Creeks Roofing (sample)', on: 'Frontdesk', pays: 397, earned: false, state: 'On hold until Oct 24 (a new client’s first payment waits 30 days)' }
  ];
  function totals() {
    var ready = 0, hold = 0;
    BOOK.forEach(function (b) { var c = b.pays * PW.rate; if (b.earned) ready += c; else hold += c; });
    return { ready: ready, hold: hold, paid: 0 };
  }

  /* ---------- entry check: the rules from the partner guide people trip on ---------- */
  var QUIZ = [
    { q: 'A business owner asks, “Can you do it cheaper?” What do you say?',
      a: [['I can’t change prices, they’re the same for everyone. Let’s make sure you’re on the right product.', 1], ['I’ll give you part of my commission.', 0], ['I can get you a special deal.', 0]],
      why: 'Station sets prices and they’re the same for everyone. Never offer part of your commission, a deal or a longer trial.' },
    { q: 'A client pays Station for a new website build. Do you earn 40% of the build fee?',
      a: [['Yes, 40% of everything they pay.', 0], ['No. You earn 40% of what they pay every month, never one-time fees.', 1]],
      why: 'Your 40% is on the monthly payments that clear. Setup fees and website build fees earn nothing, but the monthly plan behind them earns you every month.' },
    { q: 'Someone asks, “Do you work for Station?”',
      a: [['Yes, I’m on Station’s sales team.', 0], ['I’m an independent partner with Station, and I earn a commission if you sign up.', 1]],
      why: 'You’re an independent partner, not an employee. Saying so honestly is what makes people trust you.' },
    { q: 'A roofer wants the missed-call text-back working today. What do you tell them?',
      a: [['It’ll be live today.', 0], ['Anything that sends texts needs carrier registration first. It takes about 2 business days, and Station files it.', 1]],
      why: 'Never say “live today” for anything that texts. Calls and chat can go live the same day; texting waits on the carriers.' },
    { q: 'When are you allowed to call a business?',
      a: [['Any time I’m free.', 0], ['9 am to 8 pm, Monday to Saturday, in the business’s own time zone.', 1]],
      why: 'The call button only works during those hours, in their local time. Every lead card shows their time and whether it’s OK to call.' }
  ];

  /* ---------- router ---------- */
  var VIEWS = {}, tick = null;
  function route() {
    clearInterval(tick); tick = null;
    var parts = (location.hash || '').replace(/^#/, '').split('/');
    if (!S.entered && parts[0] !== 'check') { renderWelcome(); return; }
    if (parts[0] === 'check' && !S.name) { renderWelcome(); return; }
    (VIEWS[parts[0]] || VIEWS.home)(parts[1]);
  }
  function chrome(on, tab) {
    document.getElementById('bar').hidden = !on; document.getElementById('tabbar').hidden = !on;
    document.body.classList.toggle('has-tabs', on);
    document.body.classList.toggle('calls-mode', tab === 'calls');
    document.querySelectorAll('[data-tab]').forEach(function (a) { var here = a.getAttribute('data-tab') === tab; a.classList.toggle('on', here); if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.getElementById('chipBal').textContent = money(totals().ready);
  }
  function mount(html, title) {
    main.innerHTML = html; window.scrollTo(0, 0);
    document.title = title ? title + ' · Partner World' : 'Partner World';
    var h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ---------- welcome ---------- */
  function renderWelcome() {
    chrome(false);
    mount('<section class="enter"><div class="enter-card">' +
      '<span class="tiles" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '<h1>Welcome to Partner World</h1>' +
      '<p class="intro">Pick something to sell, call the businesses Station gives you, and get paid every month your clients stay.</p>' +
      '<ol class="steps3"><li><b>1</b><span><strong>Pick a product.</strong> Each product page tells you who to call, what to say and what you earn.</span></li>' +
      '<li><b>2</b><span><strong>Call your list.</strong> One business per screen. Tap to call, tap what happened, next.</span></li>' +
      '<li><b>3</b><span><strong>Get paid.</strong> 40% of what your clients pay Station, every month they stay.</span></li></ol>' +
      '<form id="hello" novalidate>' +
      '<label class="field" for="w-name">Your first name<input class="text" id="w-name" autocomplete="given-name" aria-describedby="e-name" value="' + esc(S.name) + '"></label><p class="field-err" id="e-name" role="alert"></p>' +
      '<label class="field" for="w-code">Your partner code<span class="hint">It’s in your invite email, something like jsmith. It goes on your links so every sale is credited to you.</span><input class="text" id="w-code" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="e-code w-codeuse" value="' + esc(S.code) + '"></label>' +
      '<p class="hint" id="w-codeuse" aria-live="polite"></p><p class="field-err" id="e-code" role="alert"></p>' +
      '<p class="small" style="margin:0 0 16px">Next: a 1-minute check, five questions on the rules that matter most.</p>' +
      '<button class="btn btn-dark btn-big btn-block" type="submit">Start the 1-minute check</button></form>' +
      '</div></section>', 'Welcome');
    var nameIn = document.getElementById('w-name'), codeIn = document.getElementById('w-code'), use = document.getElementById('w-codeuse');
    function codeState() {
      var raw = codeIn.value.trim().toLowerCase();
      var ok = /^[a-z0-9-]{2,30}$/.test(raw);
      use.textContent = ok ? 'Your links will end in ?ref=' + raw : '';
      return { raw: raw, ok: ok };
    }
    codeIn.addEventListener('input', function () { codeState(); document.getElementById('e-code').textContent = ''; });
    nameIn.addEventListener('input', function () { document.getElementById('e-name').textContent = ''; });
    codeState();
    document.getElementById('hello').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = nameIn.value.trim(), c = codeState();
      if (!n) { document.getElementById('e-name').textContent = 'Please add your first name.'; nameIn.focus(); return; }
      if (!c.raw) { document.getElementById('e-code').textContent = 'Please add the partner code from your invite email.'; codeIn.focus(); return; }
      if (!c.ok) { document.getElementById('e-code').textContent = 'A partner code is only letters, numbers and dashes, with no spaces, like jsmith. Check your invite email.'; codeIn.focus(); return; }
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
        body += '<button class="choice' + cls + '" type="button" data-k="' + k + '"' + (picked != null ? ' disabled' : '') + '>' + esc(q.a[k][0]) + '</button>';
      });
      body += '</div>';
      if (picked != null) {
        body += '<div class="explain ' + (ok ? 'good' : 'bad') + '" role="status"><strong>' + (ok ? 'Right. ' : 'Not quite. Have another look. ') + '</strong>' + (ok ? esc(q.why) : '') + '</div>' +
          (ok ? '<button class="btn btn-dark btn-big btn-block" id="qNext" type="button">' + (i === QUIZ.length - 1 ? (retake ? 'Done' : 'Enter Partner World') : 'Next question') + '</button>'
              : '<button class="btn btn-big btn-block" id="qRetry" type="button">Try that one again</button>');
      }
      body += '</div></section>';
      mount(body, 'Quick check');
      main.querySelectorAll('.choice').forEach(function (b) { b.addEventListener('click', function () { draw(+b.getAttribute('data-k')); }); });
      var nx = document.getElementById('qNext'), rt = document.getElementById('qRetry');
      if (nx) { nx.focus(); nx.addEventListener('click', function () { if (i === QUIZ.length - 1) { S.entered = true; save(); location.hash = retake ? '#help' : '#home'; toast(retake ? 'Check passed.' : 'You’re in. Pick a product to start.'); } else { i++; order = null; draw(null); } }); }
      if (rt) { rt.focus(); rt.addEventListener('click', function () { order = shuffle(q.a.length); draw(null); }); }
    }
    draw(null);
  };

  /* ---------- home: money, your calls, every product ---------- */
  function boxCard(b) {
    var badges = '';
    if (b.easy) badges += '<span class="badge first">Good first pick</span>';
    if (b.bundle) badges += '<span class="badge bundle">Bundle</span>';
    if (b.soon) badges += '<span class="badge soon">Coming soon</span>';
    var earn = b.earn ? '<span class="earn">You earn ' + money(b.earn) + ' a ' + period(b) + ' per client</span>'
      : '<span class="earn tbd">' + (b.id === 'website' ? 'You earn on their monthly care plan' : 'Not open to partners yet') + '</span>';
    return '<a class="box' + (b.soon ? ' is-soon' : '') + '" href="#box/' + b.id + '"><div class="badges">' + badges + '</div><span class="name">' + esc(b.name) + '</span><span class="what">' + esc(b.what) + '</span>' + earn + '</a>';
  }
  function closedNote(n) {
    if (n.ok) return 'Calls are 9 am to 8 pm, Monday to Saturday, in their time zone.';
    if (n.sun) return 'Calls are closed on Sundays. They open Monday at 9 am, their time.';
    if (n.early) return 'It’s too early to call. Calls open at 9 am, their time.';
    return 'It’s too late to call. Calls open ' + n.opens + ', their time.';
  }
  function easyFirst(a, b) { var k = function (x) { return x.easy ? 0 : x.id === 'website' ? 2 : 1; }; return k(a) - k(b); }
  VIEWS.home = function () {
    chrome(true, 'home');
    var t = totals(), c = counts(), last = usable(BOX[S.lastBox]), f = S.filter, now = localTime('TX');
    if (['all', 'easy', 'pay', 'bundles', 'soon'].indexOf(f) < 0) f = 'all';
    var list = PW.boxes.slice(), groups = '', note = '';
    if (f === 'easy') { list = list.filter(function (b) { return b.easy; }); note = 'The simplest products to explain on a first call.'; }
    if (f === 'pay') { list = list.filter(function (b) { return b.earn && !b.bundle; }).sort(function (a, b) { return perMonth(b) - perMonth(a); }); note = 'Single products, ranked by what you earn per client each month. Revive pays $198.80 a quarter, about $66 a month. Bundles pay more: see the Bundles filter.'; }
    if (f === 'bundles') { list = list.filter(function (b) { return b.bundle; }); note = 'Several Station products together for one bigger monthly price. No free trial on bundles.'; }
    if (f === 'soon') { list = list.filter(function (b) { return b.soon; }); note = 'Learn these now. You can’t sell them until Station opens them to partners.'; }
    if (f !== 'all') groups = '<p class="filter-note">' + note + '</p><div class="grid">' + list.map(boxCard).join('') + '</div>';
    else PW.brands.forEach(function (br) {
      var items = list.filter(function (b) { return b.brand === br.id; });
      var singles = items.filter(function (b) { return !b.bundle; }).sort(easyFirst), bundles = items.filter(function (b) { return b.bundle; });
      groups += '<div class="brand-head"><h2><span class="dot ' + br.id + '" aria-hidden="true"></span>' + esc(br.name) + (br.id !== 'station' ? ' <span class="badge soon">Coming soon</span>' : '') + '</h2><p>' + esc(br.sells) + ' Sells to: ' + esc(br.to) + '.</p></div>' +
        '<div class="grid">' + singles.map(boxCard).join('') + '</div>' +
        (bundles.length ? '<h3 class="sub-h">Station bundles: several products, one bigger monthly</h3><div class="grid">' + bundles.map(boxCard).join('') + '</div>' : '');
    });
    var chip = function (k, label) { return '<button class="chip" type="button" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + label + '</button>'; };
    var callNote = closedNote(now);
    mount('<div class="wrap home"><div class="hello"><div><h1>Hi ' + esc(S.name) + '.</h1><p>Pick a product, learn it in two minutes, start calling.</p></div></div>' +
      '<div class="top-row"><a class="money-box" href="#money"><span class="lbl">Earned so far (sample)</span><span class="big">' + money(t.ready) + '</span>' +
      '<span class="row"><span>On hold <b>' + money(t.hold) + '</b></span><span>Paid to date <b>' + money(t.paid) + '</b></span></span>' +
      '<span class="row warnline">Waiting on you: 2 setup steps before your first payout</span>' +
      '<span class="go"><span>See my money</span><span aria-hidden="true">&rarr;</span></span></a>' +
      '<div class="resume"><span class="small">Your calls</span><span class="count">' + c.toCall + '</span><p>' + (c.toCall === 1 ? 'business' : 'businesses') + ' to call' + (c.toCall ? ': ' + callsSummary(c) : '') + '. You’re pitching <strong>' + esc(last.name) + '</strong>.</p>' +
      '<p class="small' + (now.ok ? '' : ' closed-note') + '" id="callNote">' + callNote + '</p>' +
      '<a class="btn btn-dark btn-big" id="callGo" href="#calls/' + last.id + '">' + (c.toCall && now.ok ? 'Start calling' : 'See my list') + '</a></div></div>' +
      '<section id="wall" aria-labelledby="wallH"><h2 class="sr" id="wallH">Products you can sell</h2><div class="filters-wrap"><div class="filters" role="group" aria-label="Show">' + chip('all', 'Everything') + chip('easy', 'Easiest to start') + chip('pay', 'Biggest monthly pay') + chip('bundles', 'Bundles') + chip('soon', 'Coming soon') + '</div></div>' +
      groups + '</section></div>', 'Products');
    tick = setInterval(function () {
      if (!/^#?(home)?$/.test(location.hash)) return;
      var n2 = localTime('TX'), el = document.getElementById('callNote'); if (!el) return;
      el.textContent = closedNote(n2); el.classList.toggle('closed-note', !n2.ok);
      document.getElementById('callGo').textContent = counts().toCall && n2.ok ? 'Start calling' : 'See my list';
    }, 60000);
    main.querySelectorAll('[data-f]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.filter = btn.getAttribute('data-f'); save(); VIEWS.home();
        document.getElementById('wall').scrollIntoView({ block: 'start' });
        var fc = main.querySelector('[data-f="' + S.filter + '"]'); fc.focus({ preventScroll: true });
        fc.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    });
  };

  /* ---------- the call script, in the order you say it ---------- */
  function script(b) {
    var c = b.call || {}, lines = [];
    lines.push(['Say who you are', (b.brand === 'station' ? 'Hi, is this the owner? My name is ' : 'Hi, my name is ') + S.name + '. I’m an independent partner with ' + brandName(b.brand) + '. Do you have a minute?']);
    lines.push(['Open with', c.opener || b.ask]);
    if (c.discovery) lines.push(['Then ask', c.discovery]);
    lines.push(['The pitch', c.pitch || PW.pitch]);
    lines.push(['Close', c.close || 'Want me to send you the link so you can take a look? What’s the best email?']);
    return lines;
  }
  function scriptBlock(b) { return script(b).map(function (l, k) { return '<div class="say"><small>' + (k + 1) + ' · ' + l[0] + '</small>' + esc(l[1]) + '</div>'; }).join(''); }
  function scriptText(b) { return script(b).map(function (l) { return l[1]; }).join('\n\n'); }
  function repliesBlock(b) {
    var h = '';
    if (b.call && b.call.objection) h += '<details class="acc" open><summary>The push-back you’ll hear most on ' + esc(b.name) + '</summary><div><p>' + esc(b.call.objection) + '</p></div></details>';
    var mine = linkFor(b).replace(/^https?:\/\//, '');
    var smaller = { frontdesk: 'Lineback', 'bundle-pro': 'the Core bundle', 'bundle-custom': 'the Pro bundle' }[b.id];
    var named = b.bundle ? 'the ' + b.name : b.name;
    function fill(t) {
      t = t.replace('station.solutions/[product]/?ref=[yourcode]', mine).replace(/\[link\]/g, mine).replace(/\[yourcode\]/g, code()).replace(/\[your name\]/g, S.name).replace(/on \[day\]/g, 'later this week');
      t = smaller ? t.replace(/\[smaller option\]/g, smaller) : t.replace(/ ?If \[product\] is more than you need, \[smaller option\] may do the job\./, '');
      if (!b.trial) t = t.replace(/ ?Single products start with a 7-day free trial and there[’']s no contract, so you can try it\./, ' There’s no contract.');
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
    if (b.bundle) return 'Check the live page before you quote. Bundles have no free trial.';
    if (b.trial) return 'Check the live product page before you quote. It starts with a 7-day free trial on its standard plan, with no contract.';
    return 'Check the live product page before you quote, including whether a free trial applies.';
  }

  /* ---------- one product: everything to sell it ---------- */
  VIEWS.box = function (id) {
    var b = BOX[id]; if (!b) { location.hash = '#home'; return; }
    if (!b.soon) { S.lastBox = id; save(); }
    chrome(true, 'home');
    var link = linkFor(b), st = b.brand === 'station';
    var earnNote = b.soon ? 'Station sets partner pay for ' + b.name + ' before it opens to partners. Learn it now; calling opens when it does.'
      : b.bundle ? 'That’s 40% of the bundle price, starting with their first monthly payment once it clears. Bundles have no free trial.'
      : b.id === 'website' ? 'Station quotes each client’s monthly hosting & care. You earn 40% of whatever they pay for it, every month. The build fee earns nothing.'
      : b.id === 'revive' ? 'That\u2019s 40% of the $497 each client pays per quarter, starting after their 7-day free trial, once the payment clears. No limit on clients.'
      : b.id === 'echo' ? 'That\u2019s 40% of the $247 each client pays per month, starting after their 7-day free trial, once the payment clears. The one-time $297 setup fee earns nothing.'
      : b.trial ? 'That\u2019s 40% of what each client pays, starting after their 7-day free trial, once the payment clears. No limit on clients.'
      : 'That’s 40% of what each client pays, starting with their first payment once it clears (after any free trial). One-time setup fees earn nothing.';
    var steps = [
      ['Who to call', '<p>' + esc(b.who) + '</p>' + (st ? '<p class="small">Station sends you these businesses, a set number at a time.</p>' : '')],
      ['What to say', scriptBlock(b) + '<button class="link-btn" type="button" data-copy-script>Copy this script</button>'],
      ['If they push back', repliesBlock(b) || '<p>Keep it simple: answer the question, then offer to send the link.</p>'],
      ['When they say yes', b.id === 'website' ? '<ul class="ticks"><li>Send them your link (below) to the questions, so the demo is credited to you.</li><li>Mark the call <strong>Interested</strong>. Station builds the free demo and quotes the project.</li><li>Mark it <strong>Won</strong> only when Station tells you they’ve said yes. You earn on their monthly hosting & care.</li></ul>'
        : st ? '<ul class="ticks"><li>If they want to look first, mark the call <strong>Interested</strong> and send them your link (below). They stay on your list.</li><li>When they’re signing up, mark it <strong>Won</strong> and send the link, so the sale is credited to you. Station checks it and sets everything up; you don’t set anything up yourself.</li><li>You earn once they start paying. Station handles billing and support.</li></ul>'
        : '<p>' + esc(b.name) + ' isn’t open to partners yet, so there are no sales to log. When it opens, this step will tell you exactly what to do.</p>'],
      ['Why they buy it', '<ul class="ticks">' + (b.why.length ? b.why : [b.what]).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>'],
      ['Price', '<p><strong>' + esc(b.price) + '</strong></p>' + (priceNote(b) ? '<p class="small">' + priceNote(b) + '</p>' : '')],
      [st ? 'Your link' : 'Their website', (st ? '<p>Send this so the sale is credited to you.</p>' : '<p>For learning about it. Referral links come when it opens to partners.</p>') + '<div class="copyrow"><code>' + esc(link) + '</code><button class="btn" type="button" data-copy-link>Copy</button></div>'],
      ['More detail', b.about.map(function (p) { return p.indexOf('<ul') === 0 ? p : '<p>' + p + '</p>'; }).join('')]
    ];
    var stepsHtml = steps.map(function (s, k) { return '<section class="step"><span class="n" aria-hidden="true">' + (k + 1) + '</span><div><h2 class="step-h">' + s[0] + '</h2>' + s[1] + '</div></section>'; }).join('');
    mount('<div class="wrap prod"><a class="back" href="#home">&larr; All products</a>' +
      '<div class="prod-hero"><div><span class="pill"><span class="dot ' + b.brand + '" aria-hidden="true"></span>' + esc(brandName(b.brand)) + (b.soon ? ' · Coming soon' : '') + '</span><h1 style="margin-top:12px">' + esc(b.name) + '</h1><p class="what">' + esc(b.what) + '</p></div>' +
      '<div class="earn-card' + (b.earn ? '' : ' tbd') + '"><span class="lbl">What you earn per client</span>' +
      (b.earn ? '<div class="big num">' + money(b.earn) + '</div><div class="per">every ' + period(b) + ' they stay</div>' : '<div class="big">' + (b.id === 'website' ? '40% of their monthly care' : 'Set before it opens') + '</div>') +
      '<p>' + earnNote + '</p></div></div>' +
      '<div class="steps">' + stepsHtml + '</div></div>' +
      '<div class="cta-bar">' + (b.soon ? '<a class="btn btn-big" href="#home">Coming soon · back to products</a>' : '<a class="btn btn-dark btn-big" href="#calls/' + b.id + '">Start calling for ' + esc(b.name) + '</a>') + '</div>', b.name);
    var cl = main.querySelector('[data-copy-link]'); cl.addEventListener('click', function () { copy(link, cl); });
    var cs = main.querySelector('[data-copy-script]'); cs.addEventListener('click', function () { copy(scriptText(b), cs); });
  };

  /* ---------- the feed ---------- */
  function feedEl() { return document.getElementById('feed'); }
  function sizeFeed() {
    var f = feedEl(); if (!f) return;
    var tb = document.getElementById('tabbar'), under = getComputedStyle(tb).display === 'none' ? 0 : tb.offsetHeight;
    f.style.height = Math.max(320, window.innerHeight - f.getBoundingClientRect().top - under) + 'px';
  }
  window.addEventListener('resize', sizeFeed);
  /* scroll the FEED, never the page: scrollIntoView would also scroll the window and slide the page off the screen */
  function feedShow(el, whole, instant) {
    var f = feedEl(); if (!f || !el) return;
    var fr = f.getBoundingClientRect(), r = el.getBoundingClientRect();
    var how = instant ? 'instant' : 'smooth';
    if (whole) { f.scrollTo({ top: f.scrollTop + r.top - fr.top, behavior: how }); return; }
    if (r.bottom > fr.bottom) f.scrollTo({ top: f.scrollTop + r.bottom - fr.bottom + 12, behavior: how });
    else if (r.top < fr.top) f.scrollTo({ top: f.scrollTop + r.top - fr.top - 12, behavior: how });
  }

  VIEWS.calls = function (id) {
    clearInterval(tick); tick = null;
    var b = usable(BOX[id] || BOX[S.lastBox]);
    S.lastBox = b.id; save(); chrome(true, 'calls');
    var leads = LEADS.slice().sort(function (x, y) { var d = rank(x) - rank(y); return d || ((S.log[x.id] || {}).due || '').localeCompare((S.log[y.id] || {}).due || ''); });
    function opt(x) { return '<option value="' + x.id + '"' + (x.id === b.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }
    var sellable = PW.boxes.filter(function (x) { return !x.soon; });
    var opts = '<optgroup label="Products">' + sellable.filter(function (x) { return !x.bundle; }).sort(easyFirst).map(opt).join('') + '</optgroup>' +
      '<optgroup label="Bundles">' + sellable.filter(function (x) { return x.bundle; }).map(opt).join('') + '</optgroup>';
    var cards = leads.map(function (l, k) { return leadCard(l, b, k, leads.length); }).join('');
    cards += '<article class="lead" id="endCard"><div class="lead-card end-card"></div></article>';
    mount('<h1 class="sr">Calls</h1><div class="calls-top"><label class="sr" for="pitchSel">Product you are pitching</label><select class="text" id="pitchSel">' + opts + '</select>' +
      '<button class="btn" type="button" id="sayBtn">What do I say?</button><span class="count" id="leftCount" aria-live="polite"></span></div>' +
      '<div class="feed" id="feed" role="region" aria-label="Businesses to call, one per screen">' + cards + '</div>', 'Calls');
    var sel = document.getElementById('pitchSel');
    sel.addEventListener('change', function () { // arrow keys fire change: re-render in place and keep focus on the picker
      history.replaceState(null, '', '#calls/' + sel.value); VIEWS.calls(sel.value); document.getElementById('pitchSel').focus();
    });
    document.getElementById('sayBtn').addEventListener('click', function () { openScript(b); });
    feedEl().querySelectorAll('.lead[data-id]').forEach(function (card) { wireCard(card, b); });
    wireKeys(); updateEnd(b); sizeFeed();
    tick = setInterval(function () { refreshTimes(b); }, 15000); // times go stale and calling hours open or close while the page sits there
  };
  function updateEnd(b) {
    var c = counts(), end = document.querySelector('#endCard .lead-card');
    document.getElementById('leftCount').textContent = c.toCall + ' to call';
    var can = c.fresh === 0 && !S.asked, h, p, btn, due = c.due ? c.due + (c.due === 1 ? ' call-back' : ' call-backs') + ' due' : '';
    if (c.fresh) {
      h = 'You skipped ' + c.fresh + '.';
      p = 'Station sends the next batch once you’ve tried every new business on your list.' + (due ? ' You also have ' + due + '.' : '');
      btn = '<button class="btn btn-dark btn-big" type="button" id="toFirst">Go to the first one</button>';
    } else {
      h = 'You’ve tried every new business.';
      p = (S.asked ? 'Station has your request and will send the next batch.' : 'Ask Station for the next batch.') + (due ? ' You have ' + due + '.' : '') + (c.again ? ' Your ' + c.again + ' to try again stay on your list.' : '');
      btn = '<button class="btn btn-dark btn-big" type="button" id="askMore"' + (can ? '' : ' disabled') + '>' + (S.asked ? 'Asked. Station will send more' : 'Ask Station for more businesses') + '</button>' +
        (c.due ? '<button class="btn" type="button" id="toFirst">Go to your call-backs</button>' : '');
    }
    end.innerHTML = '<h2>' + h + '</h2><p>' + p + '</p>' + btn + '<a class="btn" href="#box/' + b.id + '">Review ' + esc(b.name) + '</a>';
    var tf = document.getElementById('toFirst');
    if (tf) tf.addEventListener('click', function () {
      var first = [].filter.call(feedEl().querySelectorAll('.lead[data-id]'), function (el) { return rank(LEAD[el.getAttribute('data-id')]) < 2; })[0];
      goTo(first);
    });
    if (can) document.getElementById('askMore').addEventListener('click', function () { S.asked = true; save(); updateEnd(b); toast('Station got your request.'); });
  }
  function refreshTimes(b) {
    if (location.hash.indexOf('#calls') !== 0 || !feedEl()) { clearInterval(tick); tick = null; return; }
    feedEl().querySelectorAll('.lead[data-id]').forEach(function (card) {
      var l = LEAD[card.getAttribute('data-id')], t = localTime(l.st), line = card.querySelector('[data-time]');
      if (!line) return;
      line.className = t.ok ? 'okc' : 'late'; line.textContent = (t.ok ? 'OK to call now' : t.why) + ' \u00b7 it\u2019s ' + t.text + ' there';
      if (String(t.ok) !== card.getAttribute('data-ok')) applyHours(card, l, t);
    });
  }
  function applyHours(card, l, t) {
    card.setAttribute('data-ok', String(t.ok));
    var btn = card.querySelector('.call-btn');
    if (btn) { var tmp = document.createElement('div'); tmp.innerHTML = callBtnHtml(l, t); btn.parentNode.replaceChild(tmp.firstChild, btn); }
    var cn = card.querySelector('[data-copynum]');
    if (!t.ok && cn) cn.parentNode.removeChild(cn);
    if (t.ok && !cn && btn) card.querySelector('[data-next]').insertAdjacentHTML('beforebegin', '<button class="link-btn" type="button" data-copynum>Copy number</button>');
    var rd = card.querySelector('[data-row="day"]');
    if (rd) { [].slice.call(rd.querySelectorAll('[data-day]')).forEach(function (x) { x.parentNode.removeChild(x); }); rd.insertAdjacentHTML('beforeend', dayButtons(t.ok || t.early)); }
  }
  function callBtnHtml(l, t) {
    if (t.ok && !touch) return '<button class="btn btn-green call-btn" type="button" data-copycall>Copy number, then dial it on your phone<small>' + l.phone + '</small></button>';
    return t.ok ? '<a class="btn btn-green call-btn" href="tel:' + l.dial + '">Call now<small>' + l.phone + '</small></a>'
      : '<button class="btn call-btn closed" type="button" disabled>Calls open ' + t.opens + '<small>' + l.phone + '</small></button>';
  }
  /* 9: call-back choices, without two buttons that land on the same day (Saturday: tomorrow and in 2 days are both Monday) */
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
  function goTo(el) {
    if (!el) return;
    feedShow(el, true);
    var f = el.querySelector('.call-btn:not([disabled])') || el.querySelector('[data-row="1"] button') || el.querySelector('.btn:not([disabled])') || el.querySelector('button');
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
  function sendBox(l, b, s) {
    var bx = BOX[s.box] || b, link = linkFor(bx), when = new Date(s.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    var web = bx.id === 'website', named = bx.bundle ? 'the ' + bx.name : bx.name;
    var body = 'Hi, it was good to talk today. ' + (web ? 'Here are the questions for your custom website I mentioned: ' : 'Here\u2019s the page for ' + named + ' I mentioned: ') + link + '\n\n' + S.name + ', independent partner with Station';
    var subject = web ? 'Your custom website questions' : 'The page for ' + named;
    var head = s.o === 'won' ? '<strong>Won on ' + when + '.</strong> Send them your ' + esc(bx.name) + ' link so the sale is credited to you. Station checks the sale and sets them up.'
      : '<strong>Interested in ' + esc(bx.name) + '.</strong> Send them your link so they can look, and so any sale is credited to you. They stay on your list.';
    return '<div class="won-next' + (s.o === 'won' ? '' : ' warm') + '"><p>' + head + '</p>' +
      '<label class="field slim" for="em-' + l.id + '">Their email<input class="text" type="email" id="em-' + l.id + '" data-email autocomplete="off" value="' + esc(s.email || '') + '" placeholder="owner@business.com"></label>' +
      '<div class="won-btns"><a class="btn btn-green" data-mail href="mailto:' + cleanEmail(s.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) + '">Email them the link</a><button class="btn" type="button" data-copy-won>Copy link</button></div>' +
      (s.o === 'won' ? '<button class="link-btn" type="button" data-change>Marked Won by mistake? Change it</button>' : '') + '</div>';
  }
  function doneBlock(l, b, s) {
    var when = new Date(s.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (s.o === 'won') return sendBox(l, b, s);
    return '<div class="done-box"><p><strong>' + esc(OUT[s.o]) + '</strong> · marked ' + when + '. ' + (s.o === 'dnc' ? 'Never call this business again.' : s.o === 'bad' ? 'Station takes it back.' : 'This business is finished.') + '</p>' +
      '<button class="link-btn" type="button" data-change>Change this</button></div>';
  }
  function leadCard(l, b, k, n) {
    var t = localTime(l.st), s = S.log[l.id], rk = rank(l), closed = s && CLOSED[s.o];
    var suggest = (l.fits !== b.id && BOX[l.fits] && !b.bundle) ? ' <span class="small">Best fit: ' + esc(BOX[l.fits].name) + '.</span>' : '';
    var pill = s ? '<span class="pill ' + (closed ? 'status' : rk === 0 ? 'due' : 'again') + '">' + esc(statusText(s)) + '</span>' : '<span class="pill">New</span>';
    var callBtn = callBtnHtml(l, t);
    var outcomes = '<div class="outcome-area"' + (closed ? ' hidden' : '') + '><div class="what-row"><span class="small">What happened?</span><button class="link-btn" type="button" data-glossary>What do these mean?</button></div><div class="outcomes" data-row="1">' +
      '<button type="button" data-o="noanswer">No answer</button><button type="button" data-o="voicemail">Voicemail</button>' +
      '<button type="button" data-o="bad">Bad lead</button><button type="button" data-o="talked">Talked to them</button></div>' +
      '<div class="outcomes" data-row="2" hidden><p class="small wide row-h" tabindex="-1">How did it go?</p>' +
      '<button type="button" data-o="interested">Interested</button><button type="button" data-o="callback">Call back</button>' +
      '<button type="button" data-o="notint">Not interested</button><button type="button" data-o="dnc">Do not call</button>' +
      '<button type="button" class="wide won" data-o="won">Won: they’re buying</button></div>' +
      '<div class="outcomes" data-row="day" hidden><p class="small wide row-h" tabindex="-1">When should you call them back?</p>' +
      dayButtons(t.ok || t.early) + '</div></div>';
    return '<article class="lead" id="lead-' + l.id + '" data-id="' + l.id + '" data-ok="' + t.ok + '"><div class="lead-card' + (closed && s.o !== 'won' ? ' done' : '') + '">' +
      '<div class="lead-meta"><span class="pill from" title="How long this business stays on your list before Station gives it to someone else.">◆ From Station · ' + l.days + ' days to work it</span>' + pill + '<span class="pill">' + (k + 1) + ' of ' + n + '</span></div>' +
      '<div><h2>' + esc(l.name) + '</h2><div class="facts"><span>' + esc(l.trade) + ' · ' + esc(l.city) + ', ' + l.st + '</span><span>★ ' + l.rating + ' (' + l.reviews + ' reviews)</span></div></div>' +
      (closed ? '' : '<div class="facts"><span data-time class="' + (t.ok ? 'okc' : 'late') + '">' + (t.ok ? 'OK to call now' : t.why) + ' · it’s ' + t.text + ' there</span></div>') +
      '<div class="fit"><b>Talking point</b>' + esc(l.gap) + suggest + '</div>' +
      (closed ? doneBlock(l, b, s) : callBtn) + (s && !closed && (s.o === 'interested' || s.wasInterested) ? sendBox(l, b, s) : '') + outcomes +
      '<div class="note-box"' + (S.notes[l.id] ? '' : ' hidden') + '><label class="sr" for="note-' + l.id + '">Note about ' + esc(l.name) + '</label><input class="text" id="note-' + l.id + '" placeholder="One-line note, saved as you type" value="' + esc(S.notes[l.id] || '') + '"></div>' +
      '<div class="card-links"><button class="link-btn" type="button" data-note>' + (S.notes[l.id] ? 'Edit note' : 'Add a note') + '</button>' + (t.ok && !closed ? '<button class="link-btn" type="button" data-copynum>Copy number</button>' : '') + '<button class="link-btn" type="button" data-next>Next ↓</button></div></div></article>';
  }
  function renderCard(card, b) {
    var l = LEAD[card.getAttribute('data-id')], list = [].slice.call(feedEl().querySelectorAll('.lead[data-id]')), k = list.indexOf(card);
    var tmp = document.createElement('div'); tmp.innerHTML = leadCard(l, b, k, list.length);
    var fresh = tmp.firstChild; card.parentNode.replaceChild(fresh, card); wireCard(fresh, b);
    updateEnd(b);
    return fresh;
  }
  function wireCard(card, b) {
    var id = card.getAttribute('data-id'), l = LEAD[id];
    var area = card.querySelector('.outcome-area'), r2 = card.querySelector('[data-row="2"]'), rd = card.querySelector('[data-row="day"]');
    function reveal(el) { el.hidden = false; feedShow(el); el.querySelector('.row-h').focus({ preventScroll: true }); }
    function rerender(focusSel) {
      var fresh = renderCard(card, b);
      if (focusSel) { var f = fresh.querySelector(focusSel); if (f) { feedShow(fresh, true, true); feedShow(f, false, true); f.focus({ preventScroll: true }); } }
      return fresh;
    }
    function record(o, extra) {
      var prev = S.log[id] || {}, was = prev.o === 'interested' || prev.wasInterested;
      S.log[id] = Object.assign({ o: o, box: b.id, at: Date.now() }, prev.email ? { email: prev.email } : {}, was && o !== 'interested' ? { wasInterested: true } : {}, extra || {}); save();
    }
    function advance(el) { setTimeout(function () { goTo(el.nextElementSibling); }, 700); }
    card.querySelector('[data-next]').addEventListener('click', function () { goTo(card.nextElementSibling); });
    card.querySelector('[data-note]').addEventListener('click', function () { var nb = card.querySelector('.note-box'); nb.hidden = false; feedShow(nb); nb.querySelector('input').focus({ preventScroll: true }); });
    card.querySelector('.note-box input').addEventListener('input', function () { var v = this.value.slice(0, 200); if (v.trim()) S.notes[id] = v; else delete S.notes[id]; save(); });
    card.querySelector('.card-links').addEventListener('click', function (e) { var cn = e.target.closest('[data-copynum]'); if (cn) copy(l.phone, cn); });
    card.addEventListener('click', function (e) {
      var cb = e.target.closest('.call-btn'); if (!cb || cb.disabled) return;
      var now = localTime(l.st);
      if (!now.ok) { e.preventDefault(); applyHours(card, l, now); toast('Calls just closed for this business.'); return; }
      if (cb.hasAttribute('data-copycall')) { try { navigator.clipboard.writeText(l.phone); toast('Number copied. Dial it on your phone.'); } catch (x) { toast('Dial ' + l.phone + ' on your phone.'); } }
    });
    card.querySelector('[data-glossary]').addEventListener('click', openGlossary);
    var ch = card.querySelector('[data-change]');
    if (ch) ch.addEventListener('click', function () {
      var s = S.log[id];
      if (s.o === 'dnc' && ch.getAttribute('data-armed') !== '1') { ch.setAttribute('data-armed', '1'); ch.textContent = 'They asked not to be called. Only change it if you tapped it by mistake. Tap again to change.'; return; }
      area.hidden = false; ch.parentNode.hidden = true; card.querySelector('.lead-card').classList.remove('done');
      var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'link-btn'; cancel.textContent = 'Cancel, keep it as ' + OUT[s.o];
      cancel.addEventListener('click', function () { renderCard(card, b).querySelector('[data-change]').focus(); });
      area.appendChild(cancel); feedShow(area); area.querySelector('button[data-o]').focus({ preventScroll: true });
    });
    var em = card.querySelector('[data-email]');
    if (em) em.addEventListener('input', function () {
      S.log[id].email = em.value.trim().slice(0, 120); save();
      var a = card.querySelector('[data-mail]'); a.setAttribute('href', a.getAttribute('href').replace(/^mailto:[^?]*/, 'mailto:' + cleanEmail(S.log[id].email)));
    });
    var cw = card.querySelector('[data-copy-won]'); if (cw) cw.addEventListener('click', function () { copy(linkFor(BOX[S.log[id].box] || b), cw); });
    card.querySelectorAll('[data-o]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var o = btn.getAttribute('data-o'), inRow2 = r2.contains(btn);
        card.querySelectorAll('[data-o]').forEach(function (x) { x.classList.toggle('sel', x === btn || (inRow2 && x.getAttribute('data-o') === 'talked')); });
        if (o !== 'callback') rd.hidden = true;
        if (o === 'talked') { reveal(r2); return; }
        if (o === 'callback') { reveal(rd); return; }
        record(o);
        if (o === 'won' || o === 'interested') { rerender('[data-email]'); toast(o === 'won' ? 'Won! Now send them your link.' : 'Saved. Send them your link.'); return; }
        var fresh = rerender();
        toast(o === 'dnc' ? 'Saved. Nobody calls them again.' : o === 'interested' ? 'Saved. They stay on your list.' : CLOSED[o] ? 'Saved. That one’s finished.' : 'Saved. Try them again another day.');
        advance(fresh);
      });
    });
    rd.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-day]'); if (!btn) return;
      (function () {
        var lt = localTime(l.st), n = +btn.getAttribute('data-day'); if (n === 0 && !lt.ok && !lt.early) n = 1;
        var due = n === 0 ? today() : addDays(n);
        record('callback', { due: due });
        var fresh = rerender();
        toast('Call back ' + dayLabel(due) + '. They stay on your list.');
        advance(fresh);
      })();
    });
  }

  /* ---------- sheets (script + button glossary); focus stays inside while open ---------- */
  var lastFocus = null, sheet = document.getElementById('sheet');
  function openSheet(title, html) {
    lastFocus = document.activeElement;
    document.getElementById('sheetTitle').textContent = title; document.getElementById('sheetBody').innerHTML = html;
    sheet.hidden = false; document.getElementById('sheetClose').focus();
  }
  function openScript(b) {
    openSheet(b.name + ': what to say', scriptBlock(b) + '<h3 class="sheet-h">If they push back</h3>' + (repliesBlock(b) || '<p>Answer the question, then offer to send the link.</p>') +
      (b.brand === 'station' ? '<h3 class="sheet-h">Other good questions</h3><ul class="ticks">' + PW.qualify.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' : ''));
  }
  function openGlossary() {
    openSheet('What the buttons mean', '<dl class="gloss">' +
      '<dt>No answer, Voicemail</dt><dd>You couldn’t reach them. They stay on your list to try another day.</dd>' +
      '<dt>Bad lead</dt><dd>Wrong number, closed down, or not a business that could use it. Station takes it back.</dd>' +
      '<dt>Talked to them</dt><dd>You spoke to someone. Then pick how it went.</dd>' +
      '<dt>Interested</dt><dd>They want to hear more. They stay on your list.</dd>' +
      '<dt>Call back</dt><dd>They asked you to call another day. Pick when; on that day they move to the top of your list.</dd>' +
      '<dt>Not interested</dt><dd>They said no. That business is finished.</dd>' +
      '<dt>Do not call</dt><dd>They asked you to stop. Nobody calls them again, and the call button goes away.</dd>' +
      '<dt>Won</dt><dd>They’re buying. Send them your link; Station checks it and sets them up.</dd>' +
      '<dt>Days to work it</dt><dd>How long this business stays on your list before Station gives it to someone else.</dd></dl>');
  }
  function closeSheet() { sheet.hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function (e) {
    if (sheet.hidden) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key !== 'Tab') return;
    var f = [].filter.call(sheet.querySelectorAll('button, summary, a[href]'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- money ---------- */
  VIEWS.money = function () {
    chrome(true, 'money');
    var t = totals();
    var won = Object.keys(S.log).filter(function (k) { return S.log[k].o === 'won' && LEAD[k]; }).map(function (k) {
      var bx = BOX[S.log[k].box]; return { client: LEAD[k].name, on: bx ? bx.name : '', earn: bx && bx.earn, per: bx ? period(bx) : 'month' };
    });
    var rows = BOOK.map(function (r) { return '<tr><td data-l="Client"><b>' + esc(r.client) + '</b></td><td data-l="On">' + esc(r.on) + '</td><td data-l="They pay" class="r num">' + money(r.pays) + ' a month</td><td data-l="You get" class="r num">' + money(r.pays * PW.rate) + ' a month</td><td data-l="Where it stands">' + esc(r.state) + '</td></tr>'; }).join('');
    rows += won.map(function (w) { return '<tr><td data-l="Client"><b>' + esc(w.client) + '</b></td><td data-l="On">' + esc(w.on) + '</td><td data-l="They pay" class="r">Not yet</td><td data-l="You’ll get" class="r num">' + (w.earn ? money(w.earn) + (w.per === 'quarter' ? ' a quarter' : ' a month') : '40% of their care plan') + '</td><td data-l="Where it stands">Won in your calls. Station checks it; you earn once they pay.</td></tr>'; }).join('');
    mount('<div class="wrap money"><h1>Your money</h1><p class="sub">Sample figures for this preview. In the real thing these come straight from Stripe.</p>' +
      '<div class="setup"><h2 class="setup-h">Waiting on you: 2 steps before your first payout</h2>' +
      '<div class="setup-row"><span><b>1. Your tax form (W-9).</b> Nothing can be paid until it’s on file. Your commission keeps building up meanwhile.</span><button class="btn" type="button" data-demo="tax">Upload W-9</button></div>' +
      '<div class="setup-row"><span><b>2. Your payout account.</b> Station pays you through Stripe. You type your bank details on Stripe’s own site; Station never sees them.</span><button class="btn" type="button" data-demo="stripe">Set up payouts with Stripe</button></div></div>' +
      '<div class="tiles3"><div class="tile hero"><span class="lbl">Earned</span><div class="v">' + money(t.ready) + '</div><p>Yours. Paid in the first payout after both steps above are done.</p></div>' +
      '<div class="tile"><span class="lbl">On hold</span><div class="v">' + money(t.hold) + '</div><p>Not yours to spend yet: a new client’s first payment waits 30 days after it clears.</p></div>' +
      '<div class="tile"><span class="lbl">Paid to date</span><div class="v">' + money(t.paid) + '</div><p>Payouts go out every two weeks once $50 or more is ready.</p></div></div>' +
      '<h2>Your clients</h2><div class="table-wrap"><table><thead><tr><th scope="col">Client</th><th scope="col">On</th><th scope="col" class="r">They pay</th><th scope="col" class="r">You get</th><th scope="col">Where it stands</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h2 class="gap-h">How you get paid</h2><div class="howpay">' +
      '<div><b>40% every month</b>Of what each client pays Station, for as long as they stay a client.</div>' +
      '<div><b>After the free trial</b>Every single product starts with a 7-day trial. You earn from their first real payment. Bundles and custom websites have no trial.</div>' +
      '<div><b>Every two weeks</b>Paid to your Stripe account once $50 or more is ready. Smaller amounts roll forward and never expire.</div>' +
      '<div><b>Monthly fees only</b>Setup fees and website build fees earn nothing; the monthly plan behind them does.</div></div></div>', 'Money');
    main.querySelectorAll('[data-demo]').forEach(function (x) { x.addEventListener('click', function () { toast(x.getAttribute('data-demo') === 'tax' ? 'In the real portal this opens a secure upload.' : 'In the real portal this opens your own Stripe setup.'); }); });
  };

  /* ---------- help ---------- */
  VIEWS.help = function () {
    chrome(true, 'help');
    mount('<div class="wrap help"><h1>Help</h1>' +
      '<h2>Stuck on something?</h2><p>Email the Station team at <a href="mailto:main@station.solutions">main@station.solutions</a>. People answer, usually the same day. Station doesn’t have a phone line, so never give out a number for Station.</p>' +
      '<h2>The rules, in one breath</h2><ul class="ticks">' +
      '<li>You’re an independent partner. Say so if anyone asks.</li><li>Never change a price, offer a deal or share your commission.</li>' +
      '<li>Never promise results, a ranking or a go-live date. Anything that texts waits about 2 business days on the carriers.</li>' +
      '<li>Call businesses 9 am to 8 pm, Monday to Saturday, their time. If someone says stop, stop, and mark them Do not call.</li>' +
      '<li>Your link is what credits a sale to you, so send it every time. Log every call too, so Station knows who’s been called and can send you more.</li>' +
      '<li>Don’t copy leads or client details into your own spreadsheet or CRM, and never ask a business to send you their customer list.</li></ul>' +
      '<h2>What the call buttons mean</h2><p>No answer, Call back, Won and the rest, in plain words.</p><button class="btn" type="button" id="glossBtn">Show me</button>' +
      '<h2>Your 30-second pitch for Station</h2><div class="say">' + esc(PW.pitch) + '</div>' +
      '<h2>Take the check again</h2><p>Five questions, one minute.</p><a class="btn" href="#check">Retake the check</a>' +
      '<h2>Start over</h2><p>Clears your name and the calls you logged in this preview, on this device only.</p><button class="btn" type="button" id="reset">Reset the preview</button></div>', 'Help');
    document.getElementById('glossBtn').addEventListener('click', openGlossary);
    var r = document.getElementById('reset'), armed = null;
    r.addEventListener('click', function () {
      if (!armed) { r.textContent = (touch ? 'Tap' : 'Click') + ' again to reset'; armed = setTimeout(function () { armed = null; r.textContent = 'Reset the preview'; }, 4000); return; }
      clearTimeout(armed); try { localStorage.removeItem(KEY); } catch (e) {} S = fresh(); if (location.hash) location.hash = ''; else route();
    });
  };

  window.addEventListener('hashchange', route);
  route();
})();
