/* Station Partner World: founder view (#admin). A PREVIEW with sample partners and sample leads: nothing here is real and
   nothing is sent. It is the design for Circle Command Center > Station > Partners, where the real one will read Circle's
   own lead pool and claim ledger. Clicks are kept on this device only (localStorage pw-admin-v1), so the page can be tried.
   Loaded on demand by app.js (VIEWS.admin); the map uses Leaflet from cdnjs and OpenStreetMap tiles. */
(function () {
  'use strict';
  var KEY = 'pw-admin-v1', DEFAULT_CAP = 50, HOLD_DAYS = 14;

  /* ---------- deterministic sample data (same on every device) ---------- */
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  var CITIES = [
    ['Houston', 'TX', 29.76, -95.37, 22], ['Katy', 'TX', 29.79, -95.82, 6], ['Sugar Land', 'TX', 29.62, -95.63, 6], ['Pasadena', 'TX', 29.69, -95.21, 5],
    ['Pearland', 'TX', 29.56, -95.29, 5], ['Cypress', 'TX', 29.97, -95.69, 5], ['Spring', 'TX', 30.08, -95.42, 5], ['Conroe', 'TX', 30.31, -95.46, 4],
    ['Austin', 'TX', 30.27, -97.74, 12], ['Round Rock', 'TX', 30.51, -97.68, 5], ['San Antonio', 'TX', 29.42, -98.49, 10], ['Dallas', 'TX', 32.78, -96.80, 12],
    ['Fort Worth', 'TX', 32.75, -97.33, 8], ['Tulsa', 'OK', 36.15, -95.99, 10], ['Broken Arrow', 'OK', 36.05, -95.79, 5], ['Oklahoma City', 'OK', 35.47, -97.52, 12],
    ['Norman', 'OK', 35.22, -97.44, 8], ['Moore', 'OK', 35.34, -97.49, 4], ['Edmond', 'OK', 35.65, -97.48, 5], ['Stillwater', 'OK', 36.12, -97.06, 4]
  ];
  var TRADES = ['Plumbing', 'Roofing', 'HVAC', 'House cleaning', 'Auto repair', 'Salon', 'Dental', 'Landscaping', 'Pest control', 'Electrician', 'Pool service', 'Fencing', 'Garage doors', 'Pet grooming', 'Chiropractor', 'Auto glass'];
  var WORDS = ['Lone Star', 'Bayou', 'Cedar', 'Prairie', 'Red River', 'Magnolia', 'Pecan', 'Summit', 'Oak & Iron', 'Clearwater', 'Brightside', 'Hill Country', 'Northside', 'Riverbend', 'Big Sky', 'Sooner', 'Mesquite', 'Bluebonnet', 'Golden Hour', 'Twin Oaks'];
  var PARTNERS = [
    { code: 'dana-r', name: 'Dana R.', joined: 'Sep 22', last: 'Today 10:14 am' },
    { code: 'marcus-t', name: 'Marcus T.', joined: 'Sep 24', last: 'Today 9:52 am' },
    { code: 'linda-p', name: 'Linda P.', joined: 'Sep 29', last: 'Yesterday 4:30 pm' },
    { code: 'jaylen-w', name: 'Jaylen W.', joined: 'Oct 1', last: 'Today 11:02 am' },
    { code: 'priya-s', name: 'Priya S.', joined: 'Oct 2', last: 'Mon 2:15 pm' }
  ];
  /* how far each sample partner has got through their 50 */
  var PLAN = { 'dana-r': [50, 50], 'marcus-t': [50, 50], 'linda-p': [50, 19], 'jaylen-w': [50, 41], 'priya-s': [30, 4] };
  var STATUS = {
    pool: { label: 'In the pool', color: '#8F8A80', hollow: true },
    claimed: { label: 'With a partner, not called yet', color: '#C99A2E' },
    called: { label: 'Called: no answer, voicemail or call back', color: '#1D1D1F' },
    interested: { label: 'Interested', color: '#D9730D' },
    client: { label: 'Paying client', color: '#167A44' },
    dead: { label: 'Said no, bad lead or Do not call', color: '#B4321F' }
  };
  var ORDER = ['pool', 'claimed', 'called', 'interested', 'client', 'dead'];
  var OUTCOME = { called: ['No answer', 'Voicemail', 'Call back Thu'], interested: ['Interested · link sent', 'Interested'], client: ['Won · paying'], dead: ['Not interested', 'Bad lead · wrong number', 'Do not call'] };

  var LEADS = [], n = 0;
  CITIES.forEach(function (c) {
    for (var i = 0; i < c[4] * 2; i++) {
      n++;
      LEADS.push({ id: 'L' + n, name: pick(WORDS) + ' ' + pick(TRADES), city: c[0], st: c[1], lat: c[2] + (rnd() - 0.5) * 0.22, lng: c[3] + (rnd() - 0.5) * 0.26, s: 'pool', who: '' });
    }
  });
  /* the pool is mixed, like a real scrape across markets; deal each partner's batch from it, then give the worked ones outcomes */
  for (var j = LEADS.length - 1; j > 0; j--) { var r0 = Math.floor(rnd() * (j + 1)), t0 = LEADS[j]; LEADS[j] = LEADS[r0]; LEADS[r0] = t0; }
  var cursor = 0;
  PARTNERS.forEach(function (p) {
    var plan = PLAN[p.code], got = 0, worked = 0;
    while (got < plan[0] && cursor < LEADS.length) {
      var l = LEADS[cursor++]; if (rnd() < 0.18) continue; // leave gaps so the pool is spread over the map
      l.who = p.code; got++;
      if (worked < plan[1]) {
        worked++;
        var r = rnd();
        l.s = r < 0.48 ? 'called' : r < 0.78 ? 'dead' : r < 0.94 ? 'interested' : 'client';
        l.out = pick(OUTCOME[l.s]);
      } else l.s = 'claimed';
    }
  });
  LEADS.forEach(function (l) { if (l.s === 'pool') l.out = ''; });

  /* ---------- this device's clicks (preview only) ---------- */
  var A = { caps: {}, req: {}, filter: { who: '', hide: {} } };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || '{}'); if (saved && typeof saved === 'object') { A.caps = saved.caps || {}; A.req = saved.req || {}; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ caps: A.caps, req: A.req })); } catch (e) {} }
  function cap(code) { return A.caps[code] != null ? A.caps[code] : DEFAULT_CAP; }

  function stats(code) {
    var mine = LEADS.filter(function (l) { return l.who === code; }), o = { held: mine.length, worked: 0, calls: 0, interested: 0, won: 0, dead: 0, open: 0 };
    mine.forEach(function (l) {
      if (l.s !== 'claimed') { o.worked++; o.calls++; }
      if (l.s === 'interested') o.interested++;
      if (l.s === 'client') o.won++;
      if (l.s === 'dead') o.dead++;
      if (l.s === 'claimed') o.open++;
    });
    return o;
  }
  /* a partner may ask for more only when every business they hold has an outcome (Circle, 10-03) */
  var ASKED = { 'dana-r': '10:14 am', 'marcus-t': '9:52 am' };

  /* ---------- render ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '·'; }

  window.PW_ADMIN = function (mount, toast) {
    var pool = LEADS.filter(function (l) { return l.s === 'pool'; }).length;
    var waiting = PARTNERS.filter(function (p) { return ASKED[p.code] && !A.req[p.code]; });
    var out = LEADS.filter(function (l) { return l.who; }).length;

    function requestCard(p) {
      var st = stats(p.code), r = A.req[p.code];
      var mix = st.dead + ' said no or bad · ' + st.interested + ' interested · ' + st.won + ' won · ' + (st.worked - st.dead - st.interested - st.won) + ' no answer / voicemail';
      return '<div class="req" data-req="' + p.code + '"><div class="req-main"><b>' + esc(p.name) + '</b> asked for the next batch at ' + ASKED[p.code] + '.' +
        '<span class="small">' + st.worked + ' of ' + st.held + ' worked: ' + mix + '.</span></div>' +
        (r ? '<p class="req-done">' + (r === 'ok' ? '✓ Approved: ' + Math.min(cap(p.code), pool) + ' businesses sent' : 'Declined. ' + esc(p.name) + ' sees “Station said not yet.”') + ' <button class="link-btn" type="button" data-undo-req>Undo</button></p>'
           : '<div class="req-btns"><button class="btn btn-dark" type="button" data-ok>Approve ' + Math.min(cap(p.code), pool) + '</button><button class="btn" type="button" data-no>Not yet</button><button class="link-btn" type="button" data-see>See their ' + st.held + '</button></div>') + '</div>';
    }
    function rosterRow(p) {
      var st = stats(p.code), c = cap(p.code);
      return '<tr data-row="' + p.code + '"><th scope="row"><button class="link-btn who" type="button" data-see>' + esc(p.name) + '</button><span class="small">' + p.code + ' · joined ' + p.joined + '</span></th>' +
        '<td data-l="Holding" class="num">' + st.held + '</td>' +
        '<td data-l="Cap per batch"><span class="stepper"><button type="button" data-cap="-5" aria-label="Lower ' + esc(p.name) + '’s cap by 5">−</button><b class="num">' + c + '</b><button type="button" data-cap="5" aria-label="Raise ' + esc(p.name) + '’s cap by 5">+</button></span></td>' +
        '<td data-l="Worked" class="num">' + pct(st.worked, st.held) + '</td><td data-l="Interested" class="num">' + st.interested + '</td><td data-l="Won" class="num">' + st.won + '</td>' +
        '<td data-l="Last active">' + p.last + '</td></tr>';
    }
    mount('<div class="wrap admin"><p class="admin-note"><b>Founder preview.</b> Sample partners and sample businesses; nothing here is real or sent, and your clicks stay on this device. The real version lives in Circle Command Center › Station › Partners.</p>' +
      '<h1>Partners</h1>' +
      '<div class="a-strip"><div><b class="num">' + PARTNERS.length + '</b><span>partners</span></div><div><b class="num">' + out + '</b><span>businesses with partners</span></div>' +
      '<div><b class="num" id="aWaiting">' + waiting.length + '</b><span>batch requests waiting</span></div><div><b class="num">' + pool + '</b><span>left in the pool</span></div></div>' +
      '<section aria-labelledby="reqH"><h2 id="reqH">Batch requests</h2><p class="small">A partner can ask only once every business they hold has an outcome. Approving sends up to their cap from the pool; nobody else can hold the same business.</p>' +
      '<div id="reqs">' + (PARTNERS.filter(function (p) { return ASKED[p.code]; }).map(requestCard).join('') || '<p class="empty">No requests waiting.</p>') + '</div></section>' +
      '<section aria-labelledby="rosH"><h2 id="rosH">Partners</h2><p class="small">Default cap is ' + DEFAULT_CAP + ' businesses per batch; raise it for anyone who needs more. Each business is theirs for ' + HOLD_DAYS + ' days.</p>' +
      '<div class="table-wrap"><table class="roster"><thead><tr><th scope="col">Partner</th><th scope="col" class="r">Holding</th><th scope="col">Cap per batch</th><th scope="col" class="r">Worked</th><th scope="col" class="r">Interested</th><th scope="col" class="r">Won</th><th scope="col">Last active</th></tr></thead><tbody>' +
      PARTNERS.map(rosterRow).join('') + '</tbody></table></div><div id="drawer"></div></section>' +
      '<section aria-labelledby="mapH"><h2 id="mapH">Lead map</h2><p class="small">Every business in the pool and with partners. Sample pins around Texas and Oklahoma; in Circle these come from the real pool.</p>' +
      '<div class="map-tools"><label class="field slim" for="aWho">Partner<select class="text" id="aWho"><option value="">Everyone</option>' + PARTNERS.map(function (p) { return '<option value="' + p.code + '">' + esc(p.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="legend" role="group" aria-label="Show or hide a status">' + ORDER.map(function (k) {
        var c = LEADS.filter(function (l) { return l.s === k; }).length;
        return '<button type="button" class="lg" data-st="' + k + '" aria-pressed="true"><i style="' + (STATUS[k].hollow ? 'border:3px solid ' + STATUS[k].color : 'background:' + STATUS[k].color) + '"></i>' + STATUS[k].label + ' <b class="num">' + c + '</b></button>';
      }).join('') + '</div>' +
      '<div id="aMap" class="amap" role="region" aria-label="Map of sample businesses, coloured by status. The list below has the same businesses."><p class="small">Loading the map…</p></div>' +
      '<details class="script-peek"><summary>The same businesses as a list</summary><div id="aList"></div></details></section></div>', 'Partners (founder preview)');

    var root = document.querySelector('.admin');
    root.addEventListener('click', function (e) {
      var t = e.target, row = t.closest('[data-row]'), req = t.closest('[data-req]'), code = (row || req || {}).getAttribute ? (row || req).getAttribute(row ? 'data-row' : 'data-req') : '';
      if (t.closest('[data-cap]') && code) {
        A.caps[code] = Math.max(0, Math.min(150, cap(code) + +t.closest('[data-cap]').getAttribute('data-cap'))); save();
        row.querySelector('.stepper b').textContent = cap(code); toast(PARTNERS.filter(function (p) { return p.code === code; })[0].name + ': cap ' + cap(code) + ' per batch.');
        var rc = root.querySelector('[data-req="' + code + '"]'); if (rc && !A.req[code]) rc.outerHTML = requestCard(PARTNERS.filter(function (p) { return p.code === code; })[0]);
        return;
      }
      if (t.closest('[data-ok]') || t.closest('[data-no]')) { A.req[code] = t.closest('[data-ok]') ? 'ok' : 'no'; save(); req.outerHTML = requestCard(PARTNERS.filter(function (p) { return p.code === code; })[0]); refreshWaiting(); return; }
      if (t.closest('[data-undo-req]')) { delete A.req[code]; save(); req.outerHTML = requestCard(PARTNERS.filter(function (p) { return p.code === code; })[0]); refreshWaiting(); return; }
      if (t.closest('[data-see]') && code) { drawDrawer(code); return; }
      var lg = t.closest('[data-st]');
      if (lg) { var k = lg.getAttribute('data-st'), on = lg.getAttribute('aria-pressed') !== 'true'; lg.setAttribute('aria-pressed', String(on)); if (on) delete A.filter.hide[k]; else A.filter.hide[k] = 1; drawPins(); return; }
      if (t.closest('[data-close-drawer]')) { document.getElementById('drawer').innerHTML = ''; return; }
    });
    function refreshWaiting() { document.getElementById('aWaiting').textContent = PARTNERS.filter(function (p) { return ASKED[p.code] && !A.req[p.code]; }).length; }
    document.getElementById('aWho').addEventListener('change', function () { A.filter.who = this.value; drawPins(); });

    function drawDrawer(code) {
      var p = PARTNERS.filter(function (x) { return x.code === code; })[0], mine = LEADS.filter(function (l) { return l.who === code; });
      var d = document.getElementById('drawer');
      d.innerHTML = '<div class="drawer"><div class="drawer-head"><h3>' + esc(p.name) + '’s ' + mine.length + ' businesses</h3><button class="link-btn" type="button" data-close-drawer>Close</button></div>' +
        '<ul class="biz">' + mine.map(function (l) { return '<li><i style="' + (STATUS[l.s].hollow ? 'border:3px solid ' + STATUS[l.s].color : 'background:' + STATUS[l.s].color) + '"></i><span><b>' + esc(l.name) + '</b> · ' + esc(l.city) + ', ' + l.st + '</span><span class="small">' + esc(l.out || STATUS[l.s].label) + '</span></li>'; }).join('') + '</ul></div>';
      d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      var h = d.querySelector('h3'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
    }

    /* ---------- the map ---------- */
    var map = null, layer = null;
    function visible() { return LEADS.filter(function (l) { return !A.filter.hide[l.s] && (!A.filter.who || l.who === A.filter.who); }); }
    function drawList() {
      var v = visible();
      document.getElementById('aList').innerHTML = '<ul class="biz">' + v.slice(0, 400).map(function (l) {
        var who = PARTNERS.filter(function (p) { return p.code === l.who; })[0];
        return '<li><i style="' + (STATUS[l.s].hollow ? 'border:3px solid ' + STATUS[l.s].color : 'background:' + STATUS[l.s].color) + '"></i><span><b>' + esc(l.name) + '</b> · ' + esc(l.city) + ', ' + l.st + '</span><span class="small">' + STATUS[l.s].label + (who ? ' · ' + esc(who.name) : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    function drawPins() {
      drawList();
      if (!map) return;
      layer.clearLayers();
      visible().forEach(function (l) {
        var st = STATUS[l.s], who = PARTNERS.filter(function (p) { return p.code === l.who; })[0];
        window.L.circleMarker([l.lat, l.lng], { radius: 7, color: st.color, weight: st.hollow ? 3 : 1.5, fillColor: st.hollow ? '#FFFFFF' : st.color, fillOpacity: st.hollow ? 0.9 : 0.85 })
          .bindPopup('<b>' + esc(l.name) + '</b><br>' + esc(l.city) + ', ' + l.st + '<br>' + st.label + (l.out && l.out !== st.label ? ' · ' + esc(l.out) : '') + (who ? '<br>Partner: ' + esc(who.name) : ''))
          .addTo(layer);
      });
    }
    function makeMap() {
      var el = document.getElementById('aMap'); if (!el || !window.L) return;
      el.innerHTML = '';
      map = window.L.map(el, { scrollWheelZoom: false });
      map.fitBounds(LEADS.map(function (l) { return [l.lat, l.lng]; }), { padding: [24, 24] });
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 13, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      layer = window.L.layerGroup().addTo(map);
      drawPins();
    }
    drawList();
    if (window.L) makeMap();
    else {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; css.integrity = 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=='; css.crossOrigin = 'anonymous'; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; js.integrity = 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g=='; js.crossOrigin = 'anonymous';
      js.onload = makeMap;
      js.onerror = function () { var el = document.getElementById('aMap'); if (el) el.innerHTML = '<p class="small">The map couldn’t load here. The list below has every business.</p>'; };
      document.head.appendChild(js);
    }
  };
})();
