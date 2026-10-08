"""Builds data.js (repo root) for Partner World. Moved into the repo from the PC on 2026-10-07 (it lived only in
C:\\Users\\Circl\\partner-world, so data.js was being hand-edited and the next run would have undone those edits).
Station facts come ONLY from the live partner files (the one source partners already use):
  research/products.json  <- https://station.solutions/partners/products.json
  research/guide.md       <- https://station.solutions/partners/guide.md
Re-run after refreshing research/ (python build_data.py --fetch pulls both files fresh)."""
import json, re, sys, pathlib, urllib.request

ROOT = pathlib.Path(__file__).parent
R = ROOT / 'research'
if '--fetch' in sys.argv:
    for name in ('products.json', 'guide.md'):
        urllib.request.urlretrieve('https://station.solutions/partners/' + name, R / name)

RATE = 0.40
BANNED = re.compile(r'(?i)\bghl\b|gohighlevel|highlevel|leadconnector')


def fix(s):
    """products.json is double-encoded in places (a middle dot arrives as 'Â·'); undo that, leave clean text alone."""
    if not isinstance(s, str):
        return s
    if any(c in s for c in 'ÂâÃ'):
        try:
            return s.encode('cp1252').decode('utf-8')
        except Exception:
            try:
                return s.encode('latin-1').decode('utf-8')
            except Exception:
                return s
    return s


def deep(x):
    if isinstance(x, dict):
        return {k: deep(v) for k, v in x.items()}
    if isinstance(x, list):
        return [deep(v) for v in x]
    return fix(x)


P = deep(json.load(open(R / 'products.json', encoding='utf-8')))
G = (R / 'guide.md').read_text(encoding='utf-8')


def section(title_start):
    m = re.search(r'^### ' + re.escape(title_start) + r'.*?$\n(.*?)(?=^### |^## )', G, re.S | re.M)
    return m.group(1).strip() if m else ''


def md_inline(t):
    t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    return t


def paras(t):
    out = []
    for p in re.split(r'\n\s*\n', t):
        p = p.strip()
        if not p or p.startswith('>'):
            continue
        lines = p.split('\n')
        if all(l.strip().startswith('- ') for l in lines):
            out.append('<ul class="ticks">' + ''.join('<li>' + md_inline(l.strip()[2:]) + '</li>' for l in lines) + '</ul>')
        else:
            out.append(md_inline(' '.join(l.strip() for l in lines)))
    return out


# which qualifying question from the guide opens which product (guide: "Match their answer to one product first")
Q = {
    'calls': 'When the phone rings and you can’t answer, what happens to that caller?',
    'book': 'How do customers book you today?',
    'follow': 'When someone enquires and goes quiet, how many times do you follow up?',
    'reviews': 'How many Google reviews do you have compared with the firm you lose work to?',
    'past': 'Do you have past customers you never email?',
    'work': 'What kind of work do you do, and where?',
}
META = {  # guide section title, qualifying question, who buys, easy-start flag, group
    'lineback': ('Lineback', 'calls', 'Busy trades who answer their own phone: plumbers, roofers, HVAC, cleaners.', True),
    'frontdesk': ('Frontdesk', 'calls', 'Businesses that miss calls on jobs or after hours and want every call answered.', True),
    'repute': ('Repute', 'reviews', 'Owners with fewer Google reviews than the competitor they lose work to.', True),
    'greet': ('Greet', 'work', 'Businesses with a website that gets visitors but few enquiries.', False),
    'slate': ('Slate', 'book', 'Salons, gyms, clinics and anyone who books appointments by phone or text.', False),
    'pursuit': ('Pursuit', 'follow', 'Owners who get enquiries and only follow up once, if at all.', False),
    'echo': ('Echo', 'reviews', 'Businesses with a thin or wrong Google listing.', False),
    'dispatch': ('Dispatch', 'past', 'Businesses with a customer list they never email.', False),
    'revive': ('Revive', 'past', 'Businesses with an old customer list that has gone quiet.', False),
    'radar': ('Radar', 'work', 'Only trades and services that want business (B2B) customers.', False),
    'dial': ('Dial', 'calls', 'Owners using their personal mobile as the company line.', False),
    'tap': ('Tap', 'work', 'Trades who invoice by hand or chase payments.', False),
    'marquee': ('Marquee', 'work', 'Businesses that want steady social posts and ads without doing them.', False),
    'website': ('Storefront', 'work', 'Businesses with no website, or one that is out of date.', False),
}

boxes = []
for p in P['products']:
    sku = p.get('sku') or ''
    if p['name'] == 'Custom website':
        sku = 'website'
    if sku == 'map':
        sku = 'echo'   # renamed Map -> Echo; station.solutions/echo/ serves it
    if sku not in META:
        continue  # the free mobile app is not sold
    gtitle, qkey, who, easy = META[sku]
    gsec = section(gtitle)
    assert gsec, 'guide has no section for ' + gtitle
    mrr = p.get('mrr') or 0
    per = p.get('per') or ''
    earn = round(mrr * RATE, 2) if mrr else None
    if sku == 'website':
        # contract v6 (2026-10-07): a website earns 40% of the SETUP fee once; hosting & care earn nothing
        earn_label = '40% of the setup fee, once, when the client pays it. Hosting & care earns nothing.'
    else:
        earn_label = '${:,.2f} every month they stay'.format(earn)
    cs = p.get('call_script') or {}
    es = p.get('email_script') or {}
    box = {
        'id': sku, 'brand': 'station', 'name': 'Custom website' if sku == 'website' else p['name'],
        'what': p.get('plain', ''), 'price': p.get('price', ''), 'mrr': mrr, 'setup': p.get('setup', 0),
        'earn': earn, 'earnLabel': earn_label, 'who': who, 'easy': easy, 'ask': Q[qkey],
        'why': p.get('selling_points', []), 'about': paras(gsec),
        'call': {k: cs.get(k, '') for k in ('opener', 'discovery', 'pitch', 'objection', 'close') if cs.get(k)},
        'email': {'subject': es.get('subject', ''), 'body': es.get('body', '')} if es else None,
        'link': 'https://station.solutions/' + ('custom' if sku == 'website' else sku) + '/?ref={code}',
    }
    boxes.append(box)


def bundle_about(name):
    """The guide's 'Collections and plans' section lists all six in one block; each box shows only its own bullet, the shared note, and the free-website rules."""
    sec = section('Collections and plans')
    mine = [l.strip()[2:] for l in sec.split('\n') if l.strip().startswith('- **%s,' % name)]
    assert mine, 'guide has no bullet for ' + name
    shared = [md_inline(re.sub(r'\s+', ' ', t.strip())) for t in re.split(r'\n\s*\n', sec) if t.strip().startswith('If a client outgrows')]
    return ['<ul class="ticks"><li>' + md_inline(mine[0]) + '</li></ul>'] + shared + paras(section('The free website'))


KIND_LABEL = {'collection': 'collection', 'plan': 'plan'}
BLURB = {  # one line for the card; the full description lives on the page
    'answer': 'Never miss a customer: text-back, website chat, booking and payments.',
    'getfound': 'Be the obvious choice on Google: listing, reviews and social.',
    'followup': 'Turn leads and old customers into jobs: follow-up, win-back and email.',
    'core': 'The whole lineup at its standard tier, on one bill.',
    'pro': 'The whole lineup at its busy tier, with social and email done for them.',
    'custom': 'Top tier everywhere, social and email done for them, and a custom website.',
}
for b in P['bundles']:
    key = b['key']
    kind = b.get('kind', 'plan')
    coll = kind == 'collection'
    label = b['name'] + (' collection' if coll else ' plan')
    price = '$%s a month, no setup fee' % format(b['mrr'], ',')
    price += ', 14-day free trial' if coll else ', 30-day money-back'
    box = {'id': 'bundle-' + key, 'brand': 'station', 'bundle': True, 'kind': kind, 'name': label, 'short': b['name'], 'blurb': BLURB[key], 'what': b.get('plain', ''),
           'price': price, 'mrr': b['mrr'], 'setup': 0,
           'earn': round(b['mrr'] * RATE, 2), 'earnLabel': '${:,.2f} every month they stay'.format(b['mrr'] * RATE),
           'who': ('Owners with one clear problem to fix first. Starts with a 14-day free trial, and a free Station-built website comes with it.' if coll
                   else 'Owners who want the whole front office handled. Billed at checkout with a 30-day money-back guarantee on the first paid month; no free trial.'),
           'easy': key == 'answer', 'ask': 'What part of your week costs you the most work?', 'why': [],
           'about': bundle_about(b['name']),
           'call': {}, 'email': None,
           'link': 'https://station.solutions/?ref={code}#' + ('c-' + key if coll else 'bundles')}
    boxes.append(box)

BRANDS = [
    {'id': 'station', 'name': 'Station', 'sells': 'Tools that answer calls, follow up and win reviews for local service businesses.', 'to': 'Plumbers, roofers, HVAC, cleaners, salons, gyms, clinics, contractors'},
]

# the replies every partner needs, lifted verbatim from the guide
REPLIES = []
for t in ['"How much is it?"', '"Send me more info"', '"I already have a website"', '"Is this a scam?" / "Who are you?"', '"I need to think about it"',
          '"Can you do it cheaper?"', '"What\'s the contract?" / "Can I cancel?"', '"How long does setup take?"', '"Do I need to be techy?"']:
    sec = section(t)
    assert sec, 'guide reply missing: ' + t
    say = re.search(r'^> (.+)$', sec, re.M)
    dont = re.search(r'\*\*Don\'t say:\*\*\s*(.+)$', sec, re.M)
    REPLIES.append({'they': t.strip('"').replace('" / "', ' / '), 'say': say.group(1) if say else '', 'dont': md_inline(dont.group(1)) if dont else ''})

PITCH = re.search(r'### A 30-second pitch\s+> (.+?)\n', G, re.S).group(1)
QUALIFY = re.findall(r'^- (.+\?)$', section('Qualifying questions'), re.M)

import html as _h
for bx in boxes:  # plain-text fields must be real characters, not HTML entities (the app escapes them); 'about' stays HTML
    for k in ('name', 'what', 'who', 'ask', 'price', 'earnLabel'):
        if isinstance(bx.get(k), str):
            bx[k] = _h.unescape(bx[k])
    bx['why'] = [_h.unescape(w) for w in bx.get('why', [])]
    bx['call'] = {k: _h.unescape(v) for k, v in (bx.get('call') or {}).items()}
for r in REPLIES:
    r['say'] = _h.unescape(r['say'])
# Partner World's script corrections (see script_fixes.py for why; the live guide is untouched)
import script_fixes as SF
def _curl(t):  # typographer's apostrophes and quotes, to match the rest of the app
    t = re.sub(r"(?<=\w)'(?=\w)", '’', t)
    t = re.sub(r'(^|[\s(\u2014])"', lambda m: m.group(1) + '\u201c', t)
    return t.replace('"', '”')
def _fix(t):
    for x, y in SF.PHRASES + [('so it saves $123.', 'so it saves $123 a month.')]:
        t = t.replace(x, y)
    return re.sub(r'(\$[\d,]+)/mo(?![a-z])', lambda m: m.group(1) + ' a month', t)
def _curl_html(t):  # curl quotes in text, never inside tags
    return ''.join(p if p.startswith('<') else _curl(p) for p in re.split(r'(<[^>]+>)', t))
for bx in boxes:
    if bx['id'] in SF.CALLS:
        bx['call'] = dict(SF.CALLS[bx['id']])
    bx['call'].update(SF.CALL_EDITS.get(bx['id'], {}))
    if bx['id'] in SF.WHY:
        bx['why'] = SF.WHY[bx['id']]
    if bx['what'].endswith('saves $123'):
        bx['what'] += ' a month'
    for k in ('what', 'who', 'ask', 'price'):
        bx[k] = _curl(_fix(bx[k]))
    bx['why'] = [_curl(_fix(w)) for w in bx['why']]
    bx['call'] = {k: _curl(_fix(v)) for k, v in bx['call'].items()}
    bx['about'] = [_curl_html(_fix(a)) for a in bx['about']]
    bx['link'] = _fix(bx['link'])
    bx.pop('email', None)  # the app never shows the guide's email templates; don't ship them
    bx['replyFix'] = {_curl(k): v for k, v in SF.REPLY_BY_BOX.get(bx['id'], {}).items()}
    # live guide 10-04: every single product and the three collections start with a 14-day trial; Core/Pro/Max and the custom website have none
    bx['trial'] = bx['brand'] == 'station' and bx['id'] != 'website' and (not bx.get('bundle') or bx.get('kind') == 'collection')
    bx['guarantee'] = bx.get('kind') == 'plan'
for r in REPLIES:
    r['say'] = _curl(_fix(r['say']))
    r['they'] = _curl(r['they'])
    for x, y in SF.DONT_FIXES:
        r['dont'] = r['dont'].replace(x, y)
    r['dont'] = re.sub(r'"([^"<>]*)"', '\u201c\\1\u201d', re.sub(r"(?<=\w)'(?=\w)", '\u2019', r['dont']))
QUALIFY = [_curl(_fix(q)) for q in QUALIFY]
PITCH = _curl(_fix(PITCH))
for bx in boxes:
    assert all(k in [r['they'] for r in REPLIES] for k in bx['replyFix']), 'replyFix key matches no reply: %s' % list(bx['replyFix'])
_all = json.dumps([boxes, REPLIES, QUALIFY, PITCH], ensure_ascii=False)
assert '\\u0001' not in _all and '\x01' not in _all, 'control character in partner text'
for w in ["what we'd", 'tools we set', 'We file it', 'our national', '26 April', '/mo bought', 'Those are the part', 'enquir', 'tyre', 'catalogue', ' mobile', 'Message Station', 'annual prepay', 'srv1748596', 'I will have it', 'switch it on', 'Send me the list', 'paid for itself', 'pays for itself', 'paid for the year', '[your product]']:
    assert w not in _all, 'script fix missed: ' + w

import buyers as BY
out = {'rate': RATE, 'trialDays': 14, 'brands': BRANDS, 'boxes': boxes, 'replies': REPLIES, 'pitch': PITCH, 'qualify': QUALIFY,
       'buyers': BY.BUYERS, 'playbook': BY.PLAYBOOK, 'built': __import__('datetime').date.today().isoformat()}
blob = json.dumps(out, ensure_ascii=False, indent=0)
bad = BANNED.findall(blob)
assert not bad, 'back-office words leaked into partner data: %s' % bad
assert 'Â' not in blob and 'â€' not in blob, 'mojibake survived'
(ROOT.parent / 'data.js').write_text('window.PW=' + blob + ';\n', encoding='utf-8')
print('boxes', len(boxes), '| station', sum(1 for b in boxes if b['brand'] == 'station'), '| replies', len(REPLIES), '| qualify', len(QUALIFY), '| bytes', len(blob))
for b in boxes:
    print(' ', b['id'].ljust(15), (b['earnLabel'] or '')[:60], '| script' if b['call'] else '| NO SCRIPT')
