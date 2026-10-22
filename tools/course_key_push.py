"""Load the Station Partner course's answer key into the partner engine (engine v4.74 `course_key_set`).

The public site/course.json has NO answers; course/answer_key.json (written by course/build_course.py) has them. The engine also
needs, from the public certification block, the rubric ids, the scenario ids, good_min and max_minutes, so this joins the two and
checks they agree (every lesson's answers match its check, every quiz id is in the public pool) before anything is sent.

  python tools/course_key_push.py            # DRY RUN: checks + a summary, sends nothing
  python tools/course_key_push.py --apply    # sends course_key_set with the broker secret (~/.station/secrets/affiliate_engine_admin.json)

Run it again after every course rebuild that changes a check or the quiz: Partner World sends course.json's version with each
answer, and the engine refuses a version it doesn't hold ("reload the page"), so the key and the published file must match.
"""
import json
import os
import pathlib
import sys
import urllib.request

SITE = pathlib.Path(__file__).resolve().parent.parent
KEY = SITE.parent / "course" / "answer_key.json"
PUB = SITE / "course.json"
ENGINE = "https://n8n.srv1748596.hstgr.cloud/webhook/station-affiliates"


def build():
    pub = json.loads(PUB.read_text(encoding="utf-8"))
    key = json.loads(KEY.read_text(encoding="utf-8"))
    errs = []
    if pub.get("version") != key.get("version"):
        errs.append("course.json version %s != answer_key.json version %s (rebuild both together)" % (pub.get("version"), key.get("version")))
    checks = {l["id"]: l.get("check") or [] for m in pub["modules"] for l in m["lessons"]}
    for lid, ans in key["answers"].items():
        if lid not in checks:
            errs.append("lesson %s is in the key but not in course.json" % lid)
        elif len(ans) != len(checks[lid]):
            errs.append("lesson %s: %d answers for %d questions" % (lid, len(ans), len(checks[lid])))
        else:
            for i, a in enumerate(ans):
                if not 0 <= a < len(checks[lid][i]["options"]):
                    errs.append("lesson %s q%d: answer %d is not an option" % (lid, i + 1, a))
    for lid in checks:
        if lid not in key["answers"]:
            errs.append("lesson %s has no answers in the key" % lid)
    out = {"version": key["version"], "answers": key["answers"]}
    pc, kc = pub.get("certification"), key.get("cert")
    if pc and kc:
        pool = {q["id"]: q for q in pc.get("quiz") or []}
        for qid, row in kc["quiz"].items():
            if qid not in pool:
                errs.append("quiz %s is in the key but not in the public pool" % qid)
            elif not 0 <= row["a"] < len(pool[qid]["options"]):
                errs.append("quiz %s: answer %d is not an option" % (qid, row["a"]))
        for qid in pool:
            if qid not in kc["quiz"]:
                errs.append("quiz %s has no answer in the key" % qid)
        mc = pc.get("mock_call") or {}
        out["cert"] = {
            "pass_pct": kc.get("pass_pct", pc.get("pass_pct", 85)), "draw": kc.get("draw", pc.get("draw", 20)),
            "quiz": {q: {"a": r["a"], "module": r.get("module", "")} for q, r in kc["quiz"].items()},
            "max_minutes": mc.get("max_minutes", 6), "good_min": (mc.get("rule") or {}).get("good_min", 8),
            "scenarios": [s["id"] for s in mc.get("scenarios") or []], "rubric": [r["id"] for r in mc.get("rubric") or []],
            "scenarios_good": kc.get("scenarios_good") or {},
        }
    return out, errs


def main():
    out, errs = build()
    c = out.get("cert") or {}
    print("version", out["version"], "| lessons", len(out["answers"]), "| quiz", len(c.get("quiz", {})), "draw", c.get("draw"),
          "pass", c.get("pass_pct"), "| scenarios", c.get("scenarios"), "| rubric", len(c.get("rubric", [])), "good_min", c.get("good_min"))
    if errs:
        print("REFUSING:\n  " + "\n  ".join(errs))
        sys.exit(1)
    if "--apply" not in sys.argv:
        print("DRY RUN ok. Re-run with --apply to load it into the engine.")
        return
    secret = json.load(open(os.path.expanduser("~/.station/secrets/affiliate_engine_admin.json"), encoding="utf-8"))["secret"]
    req = urllib.request.Request(ENGINE, data=json.dumps({"action": "course_key_set", "secret": secret, "key": out, "by": "course_key_push"}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    d = d[0] if isinstance(d, list) else d
    print(json.dumps(d))
    if not d.get("ok"):
        sys.exit(1)


if __name__ == "__main__":
    main()
