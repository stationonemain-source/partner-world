# Building data.js

`data.js` is GENERATED. Never hand-edit it.

    python3 tools/build_data.py --fetch   # pulls station.solutions/partners/{guide.md,products.json} into tools/research/, writes ./data.js

- Station facts come only from the live partner files (`guide.md`, `products.json`).
- Selling psychology (ten buyers, playbook): edit `tools/buyers.py`.
- Script corrections the app applies on top of the guide: `tools/script_fixes.py`.
- Contract v6 (2026-10-07): a website earns 40% of the setup fee once; hosting & care earn nothing (`build_data.py`, website box).

Moved here from the PC (`C:\Users\Circl\partner-world`) on 2026-10-07; until then it existed only there, so `data.js`
was being hand-edited and the next build would have undone those edits. After a guide change: run it, check `git diff data.js`,
bump `data.js?v=` in index.html, commit.

# Engine v4.65 (Partner World's missing pieces, 2026-10-07)

`patch_affiliate_engine_v465_missing.py` adds what Partner World's new screens call: `pw_news` (What's new), `me.ref`
(referral numbers), `client_claim` / admin `client_claims` + `client_claim_decide` (Add a client: Station accepts or
declines; `client_add` is closed, agreement 6.2), `st_slots` / `st_book` (calls with Station on its own calendar),
a cold-lane booking confirmation to the business in `lead_book`, ceilinged partner notice emails, W-9 / W-8BEN on
`taxform_submit`, admin `pw_event_add` / `st_cal_set`. Dry run by default; `--apply` writes; refuses when v4.65 is live.

    python3 tools/patch_affiliate_engine_v465_missing.py --export /tmp/live.js
    python3 tools/patch_affiliate_engine_v465_missing.py --offline /tmp/live.js /tmp/v465.js
    node tools/affiliate_engine_v465_sandbox.js /tmp/v465.js        # PASS 57  FAIL 0 (nothing leaves the machine)

# Engine v4.74 (the Station Partner course, 2026-10-21; NOT applied until Circle's go)

`patch_affiliate_engine_v474_course.py`: course progress, server-graded lesson checks and final quiz, the practice-call upload
(stored by Circle), founder review, the lead gate (OFF by default) and per-partner exemptions. Same dry-run / --apply / --export /
--offline shape as v4.65; the sandbox `affiliate_engine_v474_sandbox.js` runs 74 checks with nothing leaving the machine.
v4.73 (the partner-pay session) composes with it in either order.

    python tools/patch_affiliate_engine_v474_course.py --export /tmp/live.js
    python tools/patch_affiliate_engine_v474_course.py --offline /tmp/live.js /tmp/v474.js
    node tools/affiliate_engine_v474_sandbox.js /tmp/v474.js         # PASS 74  FAIL 0
    python tools/course_key_push.py                                   # checks answer_key.json against course.json; --apply loads it
