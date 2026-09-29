/* Partner World (UI preview). Every Station fact comes from window.PW (built from the live partner guide and product list).
   Leads, clients and money here are SAMPLE data: fictional businesses with 555-01xx numbers, labelled on screen. */
(function () {
  'use strict';
  var PW = window.PW, KEY = 'pw-preview-v1';
  var main = document.getElementById('main');
  var BOX = {}; PW.boxes.forEach(function (b) { BOX[b.id] = b; });

  /* ---------- state (this browser only; a preview has no account) ---------- */
  var S = { name: '', code: '', entered: false, log: {}, lastBox: 'lineback', filter: 'all' };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2600); }
  function code() { return (S.code || 'yourcode').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'yourcode'; }
  function brandName(id) { return ({ station: 'Station', ribbon: 'Ribbon Leads', quorum: 'Quorum' })[id]; }
  function copy(text, btn) {
    function done(ok) { if (btn) { var o = btn.textContent; btn.textContent = ok ? 'Copied' : 'Select and copy'; setTimeout(function () { btn.textContent = o; }, 1800); } }
    try { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
  }

  /* ---------- sample leads: fictional businesses, reserved 555-01xx numbers ---------- */
  var LEADS = {
    station: [
      ['s1', 'Bayou City Plumbing Co.', 'Plumbing', 'Houston', 'TX', 4.6, 23, 'Answers their own phone; the listing says "call for same-day service."', 'lineback'],
      ['s2', 'Red River Roofing', 'Roofing', 'Tulsa', 'OK', 4.8, 61, 'Storm season. Lots of calls come in while crews are on roofs.', 'frontdesk'],
      ['s3', 'Magnolia Home Cleaning', 'House cleaning', 'Katy', 'TX', 4.9, 14, 'Great rating, only 14 reviews.', 'repute'],
      ['s4', 'Lone Star HVAC Service', 'HVAC', 'Sugar Land', 'TX', 4.4, 38, 'No online booking; "call us to schedule."', 'slate'],
      ['s5', 'Prairie Fitness Studio', 'Gym', 'Norman', 'OK', 4.7, 52, 'Books classes by phone and text.', 'slate'],
      ['s6', 'Gulf Breeze Pest Control', 'Pest control', 'Pasadena', 'TX', 4.2, 19, 'No website listed on their Google profile.', 'website'],
      ['s7', 'Cedar Bend Auto Glass', 'Auto glass', 'Round Rock', 'TX', 4.8, 9, 'Nine reviews, nearby competitor has over a hundred.', 'repute'],
      ['s8', 'Summit Electric LLC', 'Electrician', 'Edmond', 'OK', 4.5, 27, 'Owner-operator; personal mobile on the listing.', 'dial'],
      ['s9', 'Clearwater Pool Care', 'Pool service', 'Cypress', 'TX', 4.6, 33, 'Gets quote requests, follow-up unclear.', 'pursuit'],
      ['s10', 'Oak & Iron Fence Co.', 'Fencing', 'Moore', 'OK', 4.3, 12, 'Short, generic Google listing.', 'echo'],
      ['s11', 'Brightside Dental Care', 'Dental', 'Pearland', 'TX', 4.9, 88, 'Long list of past patients; asks for recalls by phone.', 'dispatch'],
      ['s12', 'Hill Country Landscaping', 'Landscaping', 'Austin', 'TX', 4.5, 21, 'Seasonal work; winter is slow.', 'revive'],
      ['s13', 'Metro Commercial Cleaning', 'Commercial cleaning', 'Dallas', 'TX', 4.4, 17, 'Sells to offices and property managers.', 'radar'],
      ['s14', 'Riverbend Salon', 'Hair salon', 'Broken Arrow', 'OK', 4.8, 104, 'Busy, lots of website visitors, no chat.', 'greet'],
      ['s15', 'Big Tex Handyman', 'Handyman', 'Conroe', 'TX', 4.1, 8, 'Invoices on paper, takes checks.', 'tap'],
      ['s16', 'Sunrise Chiropractic', 'Chiropractor', 'Tulsa', 'OK', 4.7, 45, 'Posts on Facebook a few times a year.', 'marquee'],
      ['s17', 'Northside Garage Doors', 'Garage doors', 'Spring', 'TX', 4.6, 30, 'Emergency repairs; calls after hours.', 'frontdesk'],
      ['s18', 'Pecan Street Pet Grooming', 'Pet grooming', 'Stillwater', 'OK', 4.9, 67, 'Books by phone during grooming sessions.', 'lineback']
    ],
    ribbon: [
      ['r1', 'Coastal POS Solutions', 'POS reseller', 'Tampa', 'FL', 4.7, 15, 'Sells point-of-sale systems to restaurants.', 'ribbon'],
      ['r2', 'Sunshine Linen Supply', 'Linen service', 'Orlando', 'FL', 4.3, 22, 'Supplies linens to restaurants and hotels.', 'ribbon'],
      ['r3', 'Empire Hood Cleaning', 'Hood cleaning', 'Queens', 'NY', 4.6, 18, 'Kitchen exhaust cleaning for restaurants.', 'ribbon'],
      ['r4', 'Harbor Restaurant Insurance', 'Commercial insurance', 'Miami', 'FL', 4.8, 11, 'Writes policies for bars and restaurants.', 'ribbon'],
      ['r5', 'Hudson Kitchen Equipment', 'Kitchen equipment', 'Brooklyn', 'NY', 4.5, 29, 'Sells and installs commercial kitchens.', 'ribbon'],
      ['r6', 'Palm Sign Works', 'Sign shop', 'Fort Lauderdale', 'FL', 4.7, 34, 'Makes storefront signs.', 'ribbon'],
      ['r7', 'Bay Payroll Partners', 'Payroll services', 'St. Petersburg', 'FL', 4.4, 9, 'Payroll for hospitality businesses.', 'ribbon']
    ],
    quorum: [
      ['q1', 'City of Cedar Bend', 'City government', 'Cedar Bend', 'TX', null, null, 'Posts council agendas as scanned PDFs.', 'quorum'],
      ['q2', 'Pine Hollow ISD', 'School district', 'Pine Hollow', 'OK', null, null, 'Board minutes posted monthly.', 'quorum'],
      ['q3', 'Wilton County', 'County government', 'Wilton', 'TX', null, null, 'Large document library on the county site.', 'quorum'],
      ['q4', 'Town of Maple Crossing', 'Town government', 'Maple Crossing', 'OK', null, null, 'Small staff, one clerk handles the website.', 'quorum'],
      ['q5', 'Riverside Water District', 'Special district', 'Riverside', 'TX', null, null, 'Publishes rate notices and board packets.', 'quorum'],
      ['q6', 'Stone Creek ISD', 'School district', 'Stone Creek', 'TX', null, null, 'Posts agendas the day before meetings.', 'quorum']
    ]
  };
  var TZ = { TX: 'America/Chicago', OK: 'America/Chicago', FL: 'America/New_York', NY: 'America/New_York' };
  var nIdx = 100;
  Object.keys(LEADS).forEach(function (b) {
    LEADS[b] = LEADS[b].map(function (r) {
      nIdx++;
      return { id: r[0], name: r[1], trade: r[2], city: r[3], st: r[4], rating: r[5], reviews: r[6], gap: r[7], fits: r[8], phone: '(555) 01' + String(nIdx).slice(1), days: 30 - (nIdx % 17) };
    });
  });

  function localTime(st) {
    var tz = TZ[st]; var now = new Date();
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    var h = +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now) % 24;
    var ok = p.weekday !== 'Sun' && h >= 9 && h < 20;
    var opens = p.weekday === 'Sun' || (p.weekday === 'Sat' && h >= 20) ? 'Monday at 9 am' : (h >= 20 ? 'tomorrow at 9 am' : 'today at 9 am');
    return { text: p.hour + ':' + p.minute + ' ' + p.dayPeriod, day: p.weekday, ok: ok, opens: opens };
  }

  /* ---------- sample money: two fictional clients ---------- */
  var BOOK = [
    { client: 'Juniper Lane Plumbing (sample)', on: 'Lineback', pays: 197, since: 'Aug 2026', state: 'Ready for your next payout' },
    { client: 'Two Creeks Roofing (sample)', on: 'Frontdesk', pays: 397, since: 'Sep 2026', state: 'On hold until Oct 24 (new client, 30-day window)' }
  ];
  function totals() {
    var ready = 0, hold = 0;
    BOOK.forEach(function (b) { var c = b.pays * PW.rate; if (/^Ready/.test(b.state)) ready += c; else hold += c; });
    return { ready: ready, hold: hold, month: ready + hold, paid: 0 };
  }
  function nextPayout() { // every other Friday from a fixed start
    var d = new Date(), start = new Date('2026-09-04T12:00:00');
    while (start <= d) start.setDate(start.getDate() + 14);
    return start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  /* ---------- entry check: the rules from the partner guide people trip on ---------- */
  var QUIZ = [
    { q: 'A business owner asks, “Can you do it cheaper?” What do you say?',
      a: [['I can’t change prices, they’re the same for everyone. Let’s make sure you’re on the right product.', 1], ['I’ll give you part of my commission.', 0], ['I can get you a special deal.', 0]],
      why: 'Station sets prices and they’re the same for everyone. Never offer part of your commission, a deal or a longer trial.' },
    { q: 'A client pays Station for a new website build. Do you earn 40% of the build fee?',
      a: [['Yes, 40% of everything they pay.', 0], ['No. You earn 40% of what they pay every month, never one-time fees.', 1]],
      why: 'Your 40% is on recurring monthly payments that clear. Setup fees and website build fees earn nothing, but their monthly plan earns you every month.' },
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
  function route() {
    var h = (location.hash || '').replace(/^#/, '');
    var parts = h.split('/');
    if (!S.entered && parts[0] !== 'check') { renderWelcome(); return; }
    var view = parts[0] || 'home';
    ({ home: renderHome, box: renderBox, calls: renderCalls, money: renderMoney, help: renderHelp, check: renderCheck })[view] ? ({ home: renderHome, box: renderBox, calls: renderCalls, money: renderMoney, help: renderHelp, check: renderCheck })[view](parts[1]) : renderHome();
  }
  function chrome(on, tab) {
    document.getElementById('bar').hidden = !on; document.getElementById('tabbar').hidden = !on;
    document.body.classList.toggle('has-tabs', on);
    document.querySelectorAll('[data-tab]').forEach(function (a) { var here = a.getAttribute('data-tab') === tab; a.classList.toggle('on', here); if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.getElementById('chipBal').textContent = money(totals().month);
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
      '<p class="lead">Pick something to sell, call the businesses we give you, and get paid every month your clients stay.</p>' +
      '<ol class="steps3"><li><b>1</b><span><strong>Pick a product.</strong> Each box tells you everything: who to call, what to say, what you earn.</span></li>' +
      '<li><b>2</b><span><strong>Call your list.</strong> Flick through leads like cards. Tap to call, tap what happened, next.</span></li>' +
      '<li><b>3</b><span><strong>Get paid.</strong> 40% of what your clients pay, every month they stay.</span></li></ol>' +
      '<form id="hello" novalidate><label class="field" for="w-name">Your first name<input class="text" id="w-name" autocomplete="given-name" value="' + esc(S.name) + '"></label>' +
      '<label class="field" for="w-code">Your partner code <span class="small">(from your invite; any word works in this preview)</span><input class="text" id="w-code" autocomplete="off" value="' + esc(S.code) + '" placeholder="for example jsmith"></label>' +
      '<p class="small" style="margin:0 0 16px">Next is a 1-minute check: five questions on the rules that matter most. Get one wrong and it shows you why.</p>' +
      '<button class="btn btn-dark btn-big btn-block" type="submit">Start the 1-minute check</button><p class="small" id="w-err" role="alert" style="margin:10px 0 0;color:var(--red)"></p></form>' +
      '</div></section>', 'Welcome');
    document.getElementById('hello').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = document.getElementById('w-name').value.trim();
      if (!n) { document.getElementById('w-err').textContent = 'Please add your first name.'; document.getElementById('w-name').focus(); return; }
      S.name = n.slice(0, 40); S.code = document.getElementById('w-code').value.trim().slice(0, 30); save();
      location.hash = '#check';
    });
  }

  /* ---------- the check ---------- */
  function renderCheck() {
    chrome(S.entered, 'help');
    var i = 0;
    function draw(picked) {
      var q = QUIZ[i], prog = QUIZ.map(function (_, k) { return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('');
      var body = '<section class="enter"><div class="enter-card"><div class="qprog" aria-hidden="true">' + prog + '</div>' +
        '<p class="small" style="margin:0 0 6px">Question ' + (i + 1) + ' of ' + QUIZ.length + '</p><h1 style="font-size:clamp(26px,4vw,34px)">' + esc(q.q) + '</h1><div class="choices" role="group" aria-label="Answers">';
      q.a.forEach(function (a, k) {
        var cls = picked == null ? '' : (a[1] ? ' right' : (k === picked ? ' wrong' : ''));
        body += '<button class="choice' + cls + '" type="button" data-k="' + k + '"' + (picked != null ? ' disabled' : '') + '>' + esc(a[0]) + '</button>';
      });
      body += '</div>';
      if (picked != null) {
        var ok = q.a[picked][1] === 1;
        body += '<div class="explain ' + (ok ? 'good' : 'bad') + '" role="status"><strong>' + (ok ? 'Right. ' : 'Not quite. ') + '</strong>' + esc(q.why) + '</div>' +
          (ok ? '<button class="btn btn-dark btn-big btn-block" id="qNext" type="button">' + (i === QUIZ.length - 1 ? 'Enter Partner World' : 'Next question') + '</button>'
              : '<button class="btn btn-big btn-block" id="qRetry" type="button">Try that one again</button>');
      }
      body += '</div></section>';
      mount(body, 'Quick check');
      main.querySelectorAll('.choice').forEach(function (b) { b.addEventListener('click', function () { draw(+b.getAttribute('data-k')); }); });
      var nx = document.getElementById('qNext'), rt = document.getElementById('qRetry');
      if (nx) { nx.focus(); nx.addEventListener('click', function () { if (i === QUIZ.length - 1) { S.entered = true; save(); location.hash = '#home'; toast('You’re in. Pick a box to start.'); } else { i++; draw(null); } }); }
      if (rt) { rt.focus(); rt.addEventListener('click', function () { draw(null); }); }
    }
    draw(null);
  }

  /* ---------- home: balance + the wall of boxes ---------- */
  function openCount(brand) { return LEADS[brand].filter(function (l) { return !S.log[l.id]; }).length; }
  function boxCard(b) {
    var badges = '';
    if (b.easy) badges += '<span class="badge first">Good first pick</span>';
    if (b.bundle) badges += '<span class="badge bundle">Bundle</span>';
    if (b.brand !== 'station') badges += '<span class="badge new">New</span>';
    return '<a class="box" href="#box/' + b.id + '"><div class="badges">' + badges + '</div><span class="name">' + esc(b.name) + '</span>' +
      '<span class="what">' + esc(b.what) + '</span>' +
      (b.earn ? '<span class="earn">You earn ' + money(b.earn) + (b.id === 'revive' ? ' a quarter' : ' a month') + ' per client</span>' : '<span class="earn tbd">' + esc(b.id === 'website' ? 'You earn on their monthly care plan' : 'Rate set by Station before launch') + '</span>') + '</a>';
  }
  function renderHome() {
    chrome(true, 'home');
    var t = totals(), last = BOX[S.lastBox] || BOX.lineback, left = openCount(last.brand);
    var f = S.filter || 'all';
    var list = PW.boxes.slice();
    if (f === 'easy') list = list.filter(function (b) { return b.easy; });
    if (f === 'pay') list = list.filter(function (b) { return b.earn; }).sort(function (a, b) { return b.earn - a.earn; }).slice(0, 8);
    if (['station', 'ribbon', 'quorum'].indexOf(f) > -1) list = list.filter(function (b) { return b.brand === f; });
    var groups = '';
    if (f === 'pay' || f === 'easy') {
      groups = '<div class="grid">' + list.map(boxCard).join('') + '</div>';
    } else {
      PW.brands.forEach(function (br) {
        var items = list.filter(function (b) { return b.brand === br.id; });
        if (!items.length) return;
        var singles = items.filter(function (b) { return !b.bundle; }), bundles = items.filter(function (b) { return b.bundle; });
        groups += '<div class="brand-head"><h2><span class="dot ' + br.id + '" aria-hidden="true"></span>' + esc(br.name) + '</h2><p>' + esc(br.sells) + ' Sells to: ' + esc(br.to) + '.</p></div>' +
          '<div class="grid">' + singles.map(boxCard).join('') + '</div>' +
          (bundles.length ? '<h3 style="margin:22px 0 12px">Bundles: several products at once, bigger monthly</h3><div class="grid">' + bundles.map(boxCard).join('') + '</div>' : '');
      });
    }
    var chip = function (k, label) { return '<button class="chip" type="button" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + label + '</button>'; };
    mount('<div class="wrap home"><div class="hello"><div><h1>Hi ' + esc(S.name) + '.</h1><p>Pick a box, learn it in two minutes, start calling.</p></div></div>' +
      '<div class="top-row"><a class="money-box" href="#money"><span class="lbl">Your balance</span><span class="big">' + money(t.month) + '</span>' +
      '<span class="row"><span>Ready <b>' + money(t.ready) + '</b></span><span>On hold <b>' + money(t.hold) + '</b></span><span>Next payout <b>' + esc(nextPayout()) + '</b></span></span>' +
      '<span class="go"><span>See my money</span><span aria-hidden="true">&rarr;</span></span></a>' +
      '<div class="resume"><span class="small">Pick up where you left off</span><span class="count">' + left + '</span><p>' + (left === 1 ? 'lead' : 'leads') + ' waiting for you to call, pitching <strong>' + esc(last.name) + '</strong>.</p>' +
      '<a class="btn btn-dark btn-big" href="#calls/' + last.id + '">' + (left ? 'Start calling' : 'See my list') + '</a></div></div>' +
      '<h2 class="sr">Products you can sell</h2><div class="filters" role="group" aria-label="Show">' + chip('all', 'Everything') + chip('easy', 'Easiest to start') + chip('pay', 'Biggest payout') + chip('station', 'Station') + chip('ribbon', 'Ribbon Leads') + chip('quorum', 'Quorum') + '</div>' +
      groups + '</div>', 'Products');
    main.querySelectorAll('[data-f]').forEach(function (c) { c.addEventListener('click', function () { S.filter = c.getAttribute('data-f'); save(); renderHome(); var fc = main.querySelector('[data-f="' + S.filter + '"]'); if (fc) fc.focus(); }); });
  }

  /* ---------- one box: everything to sell it ---------- */
  function scriptBlock(b) {
    var c = b.call || {}, h = '';
    h += '<div class="say"><small>Ask this first</small>' + esc(b.ask) + '</div>';
    if (c.opener) h += '<div class="say"><small>Open with</small>' + esc(c.opener) + '</div>';
    if (c.discovery) h += '<div class="say"><small>Then ask</small>' + esc(c.discovery) + '</div>';
    if (c.pitch) h += '<div class="say"><small>When they say yes, it happens</small>' + esc(c.pitch) + '</div>';
    if (!c.opener) h += '<div class="say"><small>Your 30-second pitch</small>' + esc(PW.pitch) + '</div>';
    return h;
  }
  function repliesBlock(b) {
    var h = '';
    if (b.call && b.call.objection) h += '<details class="acc" open><summary>The push-back you’ll hear most on ' + esc(b.name) + '</summary><div><p>' + esc(b.call.objection) + '</p></div></details>';
    if (b.brand === 'station') PW.replies.forEach(function (r) {
      h += '<details class="acc"><summary>“' + esc(r.they) + '”</summary><div><div class="say"><small>Say</small>' + esc(r.say) + '</div>' + (r.dont ? '<div class="dont"><b>Don’t say</b>' + r.dont + '</div>' : '') + '</div></details>';
    });
    return h;
  }
  function renderBox(id) {
    var b = BOX[id]; if (!b) { location.hash = '#home'; return; }
    S.lastBox = id; save(); chrome(true, 'home');
    var link = b.link.replace('{code}', code());
    var tbd = !b.earn;
    var steps = [
      ['Who to call', '<p>' + esc(b.who) + '</p>' + (b.brand === 'station' ? '<p class="small">Station sends you the businesses to call. You can also add any business you find yourself.</p>' : '')],
      ['What to say', scriptBlock(b) + '<button class="link-btn" type="button" data-copy-script>Copy this script</button>'],
      ['If they push back', repliesBlock(b) || '<p>Keep it simple: answer the question, then offer the free next step.</p>'],
      ['Why they buy it', b.why.length ? '<ul class="ticks">' + b.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '<p>' + esc(b.what) + '</p>'],
      ['Price', '<p><strong>' + esc(b.price) + '</strong></p>' + (b.brand === 'station' ? '<p class="small">Check the live product page before you quote. Single products start with a 7-day free trial and there’s no contract.</p>' : '')],
      ['Your link', '<p>Send this so the sale is credited to you.</p><div class="copyrow"><code id="myLink">' + esc(link) + '</code><button class="btn" type="button" data-copy-link>Copy</button></div>'],
      ['More detail', b.about.map(function (p) { return '<p>' + p + '</p>'; }).join('')]
    ];
    var stepsHtml = steps.map(function (s, k) { return '<section class="step"><span class="n" aria-hidden="true">' + (k + 1) + '</span><div><h2 class="step-h">' + s[0] + '</h2>' + s[1] + '</div></section>'; }).join('');
    mount('<div class="wrap prod"><a class="back" href="#home">&larr; All products</a>' +
      '<div class="prod-hero"><div><span class="pill"><span class="dot ' + b.brand + '" aria-hidden="true"></span>' + esc(brandName(b.brand)) + '</span><h1 style="margin-top:12px">' + esc(b.name) + '</h1><p class="what">' + esc(b.what) + '</p></div>' +
      '<div class="earn-card' + (tbd ? ' tbd' : '') + '"><span class="lbl">What you earn per client</span>' + (tbd ? '<div class="big">' + esc(b.earnLabel) + '</div>' : '<div class="big num">' + money(b.earn) + '</div><div class="per">every ' + (b.id === 'revive' ? 'quarter' : 'month') + ' they stay</div>') +
      '<p>' + (tbd ? (b.id === 'website' ? 'Station quotes each client’s monthly hosting & care. You earn 40% of whatever they pay for it, every month.' : 'Station confirms your rate on this product before it opens to partners.') : 'That’s 40% of what each client pays, starting after their free trial, once the payment clears. No cap on how many clients.') + '</p></div></div>' +
      '<div class="steps">' + stepsHtml + '</div></div>' +
      '<div class="cta-bar"><a class="btn btn-dark btn-big" href="#calls/' + b.id + '">Start calling for ' + esc(b.name) + '</a></div>', b.name);
    var cl = main.querySelector('[data-copy-link]'); cl.addEventListener('click', function () { copy(link, cl); });
    var cs = main.querySelector('[data-copy-script]');
    cs.addEventListener('click', function () { var c = b.call || {}; copy([b.ask, c.opener, c.discovery, c.pitch].filter(Boolean).join('\n\n') || PW.pitch, cs); });
  }

  /* ---------- the feed ---------- */
  var OUT = { noanswer: 'No answer', voicemail: 'Voicemail', bad: 'Bad lead', interested: 'Interested', callback: 'Call back', notint: 'Not interested', dnc: 'Do not call', won: 'Won — they’re buying' };
  function renderCalls(id) {
    var b = BOX[id] || BOX[S.lastBox] || BOX.lineback; S.lastBox = b.id; save(); chrome(true, 'calls');
    var leads = LEADS[b.brand].slice().sort(function (x, y) { return (!!S.log[x.id]) - (!!S.log[y.id]); });
    var left = leads.filter(function (l) { return !S.log[l.id]; }).length;
    var opts = PW.boxes.filter(function (x) { return !x.bundle; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === b.id ? ' selected' : '') + '>' + esc(brandName(x.brand) === 'Station' ? x.name : brandName(x.brand)) + '</option>'; }).join('');
    var cards = leads.map(function (l, k) { return leadCard(l, b, k, leads.length); }).join('');
    var done = left === 0;
    cards += '<article class="lead"><div class="lead-card end-card"><h2>' + (done ? 'You called every lead.' : 'That’s the end of your list.') + '</h2>' +
      '<p>' + (done ? 'Nice work. Ask Station for the next batch. Station sends leads a set number at a time, from the area set for you.' : 'You still have ' + left + ' ' + (left === 1 ? 'lead' : 'leads') + ' to call. Station sends more once you’ve called every one.') + '</p>' +
      '<button class="btn btn-dark btn-big" type="button" id="askMore"' + (done ? '' : ' disabled') + '>' + (done ? 'Ask Station for more leads' : 'Call your ' + left + ' remaining first') + '</button>' +
      '<a class="btn" href="#box/' + b.id + '">Review ' + esc(b.name) + '</a></div></article>';
    mount('<h1 class="sr">Calls</h1><div class="calls-top"><label class="sr" for="pitchSel">Product you are pitching</label><select class="text" id="pitchSel">' + opts + '</select>' +
      '<button class="btn" type="button" id="sayBtn">What do I say?</button><span class="count" aria-live="polite">' + left + ' left</span></div>' +
      '<div class="feed" id="feed" tabindex="0" aria-label="Leads, one per screen">' + cards + '</div>', 'Calls');
    document.getElementById('pitchSel').addEventListener('change', function () { location.hash = '#calls/' + this.value; });
    document.getElementById('sayBtn').addEventListener('click', function () { openSheet(b); });
    var ask = document.getElementById('askMore'); if (ask && !ask.disabled) ask.addEventListener('click', function () { ask.disabled = true; ask.textContent = 'Asked — Station will send more'; toast('Station got your request for more leads.'); });
    wireFeed(b);
  }
  function leadCard(l, b, k, n) {
    var t = localTime(l.st), st = S.log[l.id];
    var suggest = (l.fits !== b.id && b.brand === 'station' && BOX[l.fits]) ? ' <span class="small">Best fit: ' + esc(BOX[l.fits].name) + '.</span>' : '';
    return '<article class="lead" id="lead-' + l.id + '" data-id="' + l.id + '"><div class="lead-card' + (st ? ' done' : '') + '">' +
      '<div class="lead-meta"><span class="pill from">◆ From Station · ' + l.days + ' days left</span>' + (st ? '<span class="pill status">' + esc(OUT[st.o] || st.o) + '</span>' : '') + '<span class="pill">' + (k + 1) + ' of ' + n + '</span></div>' +
      '<div><h2>' + esc(l.name) + '</h2><div class="facts"><span>' + esc(l.trade) + ' · ' + esc(l.city) + ', ' + l.st + '</span>' + (l.rating ? '<span>★ ' + l.rating + ' (' + l.reviews + ' reviews)</span>' : '') + '</div></div>' +
      '<div class="facts"><span class="' + (t.ok ? 'okc' : 'late') + '">' + (t.ok ? 'OK to call now' : 'Too late to call') + ' · it’s ' + t.text + ' there</span></div>' +
      '<div class="fit"><b>Talking point</b>' + esc(l.gap) + suggest + '</div>' +
      (t.ok ? '<a class="btn btn-green call-btn" href="tel:' + l.phone.replace(/\D/g, '') + '">Call now<small>' + l.phone + '</small></a>'
            : '<button class="btn call-btn" type="button" disabled>Calls open ' + t.opens + '<small>' + l.phone + '</small></button>') +
      '<div><p class="small" style="margin:0 0 6px">What happened?</p><div class="outcomes" data-row="1">' +
      '<button type="button" data-o="noanswer">No answer</button><button type="button" data-o="voicemail">Voicemail</button>' +
      '<button type="button" data-o="bad">Bad lead</button><button type="button" data-o="talked">Talked to them</button></div>' +
      '<div class="outcomes" data-row="2" hidden style="margin-top:8px">' +
      '<button type="button" data-o="interested">Interested</button><button type="button" data-o="callback">Call back</button>' +
      '<button type="button" data-o="notint">Not interested</button><button type="button" data-o="dnc">Do not call</button>' +
      '<button type="button" class="wide won" data-o="won">Won — they’re buying</button></div></div>' +
      '<div class="note-box"' + (st && st.note ? '' : ' hidden') + '><label class="sr" for="note-' + l.id + '">Note</label><input class="text" id="note-' + l.id + '" placeholder="One-line note, saved with the call" value="' + esc(st && st.note || '') + '"></div>' +
      '<div class="card-links"><button class="link-btn" type="button" data-note>Add a note</button><button class="link-btn" type="button" data-next>Skip to next ↓</button></div></div></article>';
  }
  function wireFeed(b) {
    var feed = document.getElementById('feed');
    function next(from) { var el = from.nextElementSibling; if (el) el.scrollIntoView({ block: 'start' }); }
    feed.querySelectorAll('.lead[data-id]').forEach(function (card) {
      var id = card.getAttribute('data-id');
      card.querySelector('[data-next]').addEventListener('click', function () { next(card); });
      card.querySelector('[data-note]').addEventListener('click', function () { var nb = card.querySelector('.note-box'); nb.hidden = false; nb.querySelector('input').focus(); });
      card.querySelectorAll('.outcomes button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var o = btn.getAttribute('data-o');
          card.querySelectorAll('.outcomes button').forEach(function (x) { x.classList.toggle('sel', x === btn); });
          if (o === 'talked') { var r2 = card.querySelector('[data-row="2"]'); r2.hidden = false; r2.querySelector('button').focus(); return; }
          var note = card.querySelector('input').value.trim().slice(0, 200);
          S.log[id] = { o: o, note: note, box: b.id, at: Date.now() }; save();
          var msg = o === 'won' ? 'Won! Station will check it.' : o === 'callback' ? 'Saved for a call back.' : o === 'dnc' ? 'Saved. Never called again.' : 'Saved. Next lead.';
          toast(msg);
          var cardEl = card.querySelector('.lead-card'); cardEl.classList.add('done');
          var meta = card.querySelector('.lead-meta'), pill = meta.querySelector('.status');
          if (!pill) { pill = document.createElement('span'); pill.className = 'pill status'; meta.insertBefore(pill, meta.children[1]); }
          pill.textContent = OUT[o];
          var left = LEADS[b.brand].filter(function (l) { return !S.log[l.id]; }).length;
          main.querySelector('.calls-top .count').textContent = left + ' left';
          document.getElementById('chipBal').textContent = money(totals().month);
          setTimeout(function () { next(card); }, 650);
          if (left === 0) { var ask = document.getElementById('askMore'); ask.disabled = false; ask.textContent = 'Ask Station for more leads'; ask.onclick = function () { ask.disabled = true; ask.textContent = 'Asked — Station will send more'; toast('Station got your request for more leads.'); }; }
        });
      });
    });
    feed.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'ArrowUp', 'j', 'k'].indexOf(e.key) < 0 || /input|select|textarea/i.test(e.target.tagName)) return;
      e.preventDefault(); feed.scrollBy({ top: (e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1) * feed.clientHeight });
    });
  }

  /* ---------- the script sheet ---------- */
  var lastFocus = null;
  function openSheet(b) {
    lastFocus = document.activeElement;
    document.getElementById('sheetTitle').textContent = b.name + ' script';
    document.getElementById('sheetBody').innerHTML = scriptBlock(b) + '<h3 style="margin:18px 0 6px">If they push back</h3>' + repliesBlock(b) +
      '<h3 style="margin:18px 0 6px">Other good questions</h3><ul class="ticks">' + PW.qualify.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>';
    var sh = document.getElementById('sheet'); sh.hidden = false; document.getElementById('sheetClose').focus();
  }
  function closeSheet() { document.getElementById('sheet').hidden = true; if (lastFocus) lastFocus.focus(); }
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  document.getElementById('sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('sheet').hidden) closeSheet(); });

  /* ---------- money ---------- */
  function renderMoney() {
    chrome(true, 'money');
    var t = totals();
    var won = Object.keys(S.log).filter(function (k) { return S.log[k].o === 'won'; }).map(function (k) {
      var l = [].concat(LEADS.station, LEADS.ribbon, LEADS.quorum).filter(function (x) { return x.id === k; })[0], bx = BOX[S.log[k].box];
      return { client: l ? l.name : k, on: bx ? bx.name : '', earn: bx && bx.earn };
    });
    var rows = BOOK.map(function (r) { return '<tr><td data-l="Client"><b>' + esc(r.client) + '</b></td><td data-l="On">' + esc(r.on) + '</td><td data-l="They pay / mo" class="r num">' + money(r.pays) + '</td><td data-l="You get / mo" class="r num">' + money(r.pays * PW.rate) + '</td><td data-l="Where it stands">' + esc(r.state) + '</td></tr>'; }).join('');
    rows += won.map(function (w) { return '<tr><td data-l="Client"><b>' + esc(w.client) + '</b></td><td data-l="On">' + esc(w.on) + '</td><td data-l="They pay / mo" class="r">–</td><td data-l="You get / mo" class="r num">' + (w.earn ? money(w.earn) : '–') + '</td><td data-l="Where it stands">Won in your calls. Station checks it; you earn once they pay.</td></tr>'; }).join('');
    mount('<div class="wrap money"><h1>Your money</h1><p style="margin-top:8px;color:var(--ink-2)">Sample figures for this preview. In the real thing these come straight from Stripe.</p>' +
      '<div class="tiles3"><div class="tile"><span class="lbl">Ready for next payout</span><div class="v">' + money(t.ready) + '</div><p>' + (t.ready >= 50 ? 'Paid ' + esc(nextPayout()) + '.' : 'Paid once $50 is ready.') + '</p></div>' +
      '<div class="tile"><span class="lbl">On hold</span><div class="v">' + money(t.hold) + '</div><p>New clients’ first payment waits 30 days after it clears.</p></div>' +
      '<div class="tile"><span class="lbl">Paid to date</span><div class="v">' + money(t.paid) + '</div><p>Every payout goes to your Stripe account.</p></div></div>' +
      '<div class="callout"><span><b>Waiting on you: tax form.</b> Nothing is paid until your W-9 is on file. Commission still builds up.</span><button class="btn" type="button" id="taxBtn">Upload W-9</button></div>' +
      '<h2>Your clients</h2><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th scope="col">Client</th><th scope="col">On</th><th scope="col" class="r">They pay / mo</th><th scope="col" class="r">You get / mo</th><th scope="col">Where it stands</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h2 style="margin-top:30px">How you get paid</h2><div class="howpay">' +
      '<div><b>40% every month</b>Of what each client pays Station, for as long as they stay a client.</div>' +
      '<div><b>After the free trial</b>Nothing is earned during a trial. It starts with their first real payment.</div>' +
      '<div><b>Every two weeks</b>Paid to your Stripe account once $50 or more is ready. Smaller amounts roll forward.</div>' +
      '<div><b>Monthly fees only</b>Setup fees and website build fees earn nothing; the monthly plan behind them does.</div></div></div>', 'Money');
    document.getElementById('taxBtn').addEventListener('click', function () { toast('In the real portal this opens your secure tax form upload.'); });
  }

  /* ---------- help ---------- */
  function renderHelp() {
    chrome(true, 'help');
    mount('<div class="wrap help"><h1>Help</h1>' +
      '<h2>Stuck on something?</h2><p>Email the Station team at <strong>main@station.solutions</strong>. People answer, usually the same day. Station doesn’t have a phone line, so never give out a number for Station.</p>' +
      '<h2>The rules, in one breath</h2><ul class="ticks">' +
      '<li>You’re an independent partner. Say so if anyone asks.</li><li>Never change a price, offer a deal or share your commission.</li>' +
      '<li>Never promise results, a ranking or a go-live date. Anything that texts waits about 2 business days on the carriers.</li>' +
      '<li>Call businesses 9 am to 8 pm, Monday to Saturday, their time. If someone says stop, stop, and mark them Do not call.</li>' +
      '<li>Log every call. It’s how Station credits the sale to you.</li><li>Don’t copy leads or client details into your own spreadsheet or CRM.</li></ul>' +
      '<h2>Your 30-second pitch for Station</h2><div class="say">' + esc(PW.pitch) + '</div>' +
      '<h2>Take the check again</h2><p>Five questions, one minute.</p><a class="btn" href="#check">Retake the check</a>' +
      '<h2>Start over</h2><p>Clears your name and the calls you logged in this preview, on this device only.</p><button class="btn" type="button" id="reset">Reset the preview</button></div>', 'Help');
    var r = document.getElementById('reset'), armed = false;
    r.addEventListener('click', function () { if (!armed) { armed = true; r.textContent = 'Tap again to reset'; return; } try { localStorage.removeItem(KEY); } catch (e) {} S = { name: '', code: '', entered: false, log: {}, lastBox: 'lineback', filter: 'all' }; location.hash = ''; route(); });
  }

  window.addEventListener('hashchange', route);
  route();
})();
