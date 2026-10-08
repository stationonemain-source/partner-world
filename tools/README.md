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
