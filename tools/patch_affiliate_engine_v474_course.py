"""Affiliate Engine v4.74 (2026-10-21): the Station Partner course (Partner World > Learn) and the certification gate on leads.

Circle, 2026-10-21: a 14-module course + certification; progress lives in the engine (never localStorage); certification =
a final quiz + a recorded practice call a founder reviews; passing UNLOCKS leads. What this adds to n8n workflow
kuC7urcDYI0A32w7, node "Affiliate Logic" (anchors read against live v4.72; v4.73 is left for the partner-pay session):

 Partner (session token):
  course_progress_get {token}                      pure read: every lesson's done_at / score, resume point, quiz, mock call, gate
  course_progress_set {token, version, lesson, answers?}
                                                   no answers = "I opened this lesson" (resume point). answers = the lesson's
                                                   check, graded HERE against the answer key; all right = lesson done.
  cert_status {token}                              pure read: the certification part of the above
  cert_quiz_start {token, version}                 draws the final quiz (default 20 of the pool, at least one per module).
                                                   Needs every lesson done; after a failed try, a re-passed lesson check in
                                                   each missed module; 3 tries a day.
  cert_quiz_submit {token, attempt, answers:{qid: optionIndex}}
                                                   graded HERE; a failed try names the modules missed, never the answers
  mock_call_upload {token, filedata(base64), mimetype, seconds}
                                                   after the quiz: the recording goes to Circle (POST http://circle:8790/
                                                   api/course/mock-store, broker secret in X-Station-Broker) and waits for a founder
 Founder (broker secret):
  course_key_set {secret, key}                     the answer key (course/answer_key.json); the public course.json has none
  course_admin {secret}                            pure read: every Partner-track partner's progress + the practice calls
  mock_call_list {secret, status?}                 pure read
  mock_call_review {secret, id, decision: pass|redo, items:{rubricId:{mark: good|work|redo, note}}, note?, by?}
                                                   any redo item = redo; pass needs good_min goods (8 of 10); every item that
                                                   isn't good carries a note the partner reads. Pass = certified.
  course_gate_set {secret, on, by?}                the gate is OFF until Circle turns it on (nobody is locked out by a deploy)
  course_exempt_set {secret, code, on, note?, by?} a partner who keeps their leads without the course (Circle decides who)
 The gate: while it is on, cc_assign (Station deals) and cc_more (a partner asks) refuse a partner who is neither certified
 nor exempt, with a sentence that says where they are. `me` carries course:{...} so Partner World can say it too.

Run (from the Mac or the PC; needs ~/.station/secrets/n8n.json):
  python patch_affiliate_engine_v474_course.py                    # DRY RUN: backup + parse check + unified diff
  python patch_affiliate_engine_v474_course.py --apply            # write, deactivate/activate, read back
  python patch_affiliate_engine_v474_course.py --export live.js   # read only
  python patch_affiliate_engine_v474_course.py --offline live.js v474.js && node affiliate_engine_v474_sandbox.js v474.js
Idempotent: refuses when the v4.74 marker is already live. Fails loudly if any anchor is not found exactly as expected.
"""
import difflib
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

WF = "kuC7urcDYI0A32w7"
NODE = "Affiliate Logic"
MARK = 'if(action==="course_progress_get"||action==="cert_status"){'
NEEDS = '// v4.72 (2026-10-15): Cold Call Leads -- calling_holds_set'

HELPERS = r'''// ---- v4.74 (2026-10-21): the Station Partner course (Partner World > Learn) + the certification gate on leads.
// sd.course = {key, gate_on, p:{<code>:{lessons:{<lid>:{done_at,score,of,best,tries,last_at,passed_at}}, last:{lesson,at},
//   quiz:{attempts:[...], open, passed_at, review:{at,modules}}, scenario, certified_at, exempt:{on,at,by,note}}}, mocks:[...]}
// The answer key lives ONLY here (course_key_set); partners.station.solutions/course.json carries no answers.
const CRS_QUIZ_PER_DAY=3;
const CRS_ATTEMPT_MS=3*3600000;              // a drawn quiz must be handed in within 3 hours
const CRS_MOCK_MAX_BYTES=8*1024*1024;        // ~6 minutes of speech is 1-3 MB; 8 MB leaves room for a phone's own recorder
const CRS_MOCK_KEEP=500;
const CRS_MOCK_MIMES={"audio/webm":"webm","audio/ogg":"ogg","audio/mp4":"m4a","audio/x-m4a":"m4a","audio/m4a":"m4a",
  "audio/aac":"aac","audio/mpeg":"mp3","audio/mp3":"mp3","audio/wav":"wav","audio/x-wav":"wav","audio/wave":"wav",
  "video/webm":"webm","video/mp4":"m4a"};   // a browser's audio-only recording is sometimes labelled video/*
const CRS_STORE="http://circle:8790/api/course/mock-store";
function crsR(){const c=(sd.course&&typeof sd.course==="object")?sd.course:{};
  return {key:c.key||null,p:(c.p&&typeof c.p==="object")?c.p:{},mocks:Array.isArray(c.mocks)?c.mocks:[],gate_on:!!c.gate_on,gate_at:c.gate_at||null,gate_by:c.gate_by||null};}
function crsW(){if(!sd.course||typeof sd.course!=="object"){sd.course={};}const c=sd.course;
  if(!c.p||typeof c.p!=="object"){c.p={};}if(!Array.isArray(c.mocks)){c.mocks=[];}return c;}
function crsMine(code,write){
  if(write){const c=crsW();if(!c.p[code]||typeof c.p[code]!=="object"){c.p[code]={};}const p=c.p[code];
    if(!p.lessons||typeof p.lessons!=="object"){p.lessons={};}if(!p.quiz||typeof p.quiz!=="object"){p.quiz={};}
    if(!Array.isArray(p.quiz.attempts)){p.quiz.attempts=[];}return p;}
  const p=crsR().p[code]||{};
  return {lessons:p.lessons||{},last:p.last||null,quiz:p.quiz||{},scenario:p.scenario||"",certified_at:p.certified_at||null,exempt:p.exempt||null};
}
function crsModN(x){const m=/^(\d+)/.exec(String(x==null?"":x));return m?String(parseInt(m[1],10)):String(x||"");}   // "03-shelf" / "3" / "3.4" -> "3"
function crsLessonIds(){const k=crsR().key;return (k&&k.answers)?Object.keys(k.answers):[];}
function crsMocksOf(code){return crsR().mocks.filter(function(m){return m&&m.code===code;});}
function crsMockOut(m,founder){
  if(!m){return null;}
  const o={id:m.id,at:m.at,status:m.status,scenario:m.scenario||"",seconds:m.seconds||0,round:m.round||1};
  if(m.review){o.review={at:m.review.at,by:m.review.by||"",note:m.review.note||"",good:m.review.good,redo:m.review.redo,items:m.review.items||{}};}
  if(founder){o.code=m.code;o.bytes=m.bytes||0;o.mime=m.mime||"";o.ext=m.ext||"";}
  return o;
}
function crsQuizBlock(code,p){
  const k=crsR().key;
  if(!k||!k.cert||!k.cert.quiz){return "The final quiz isn't open yet.";}
  const q=p.quiz||{};
  if(q.passed_at){return "You've passed the final quiz.";}
  const ids=crsLessonIds(),done=ids.filter(function(id){return p.lessons[id]&&p.lessons[id].done_at;}).length;
  if(done<ids.length){return "Finish every lesson first ("+done+" of "+ids.length+" done).";}
  const rv=q.review;
  if(rv&&Array.isArray(rv.modules)&&rv.modules.length){
    const since=String(rv.at||"");
    const left=rv.modules.filter(function(mod){const n=crsModN(mod);
      return !ids.some(function(id){const L=p.lessons[id];return crsModN(id)===n&&L&&String(L.passed_at||"")>since;});});
    if(left.length){return "Before you try again, go back over "+(left.length===1?"this module":"these modules")+" and pass one lesson check in each: "+
      left.map(function(m){return "Module "+crsModN(m);}).join(", ")+".";}
  }
  const today=ccToday();
  const n=(q.attempts||[]).filter(function(x){return x&&ccDayOf(Date.parse(x.at)||0)===today;}).length;
  if(n>=CRS_QUIZ_PER_DAY){return "That's "+CRS_QUIZ_PER_DAY+" tries today. You can take it again tomorrow.";}
  return "";
}
function crsState(code,full){
  const c=crsR(),k=c.key,p=crsMine(code,false),q=p.quiz||{};
  const ids=crsLessonIds(),done=ids.filter(function(id){return p.lessons[id]&&p.lessons[id].done_at;}).length;
  const atts=Array.isArray(q.attempts)?q.attempts:[];
  const mocks=crsMocksOf(code),m=mocks[mocks.length-1]||null;
  const certified=!!p.certified_at,exempt=!!(p.exempt&&p.exempt.on);
  const best=atts.reduce(function(x,y){return (y&&y.pct>x)?y.pct:x;},-1);
  const out={open:!!k,version:k?String(k.version||""):"",cert_open:!!(k&&k.cert&&k.cert.quiz),gate_on:c.gate_on,
    lessons_total:ids.length,lessons_done:done,last:p.last||null,
    quiz:{passed_at:q.passed_at||null,best_pct:best<0?null:best,attempts:atts.length,last:atts.length?atts[atts.length-1]:null,
      pass_pct:(k&&k.cert&&+k.cert.pass_pct)||85,review:q.review||null,why_not:crsQuizBlock(code,p),
      open:(q.open&&(Date.parse(q.open.exp)||0)>Date.now())?{id:q.open.id,questions:q.open.qs,expires:q.open.exp}:null},
    scenario:p.scenario||"",max_minutes:(k&&k.cert&&+k.cert.max_minutes)||6,
    mock:crsMockOut(m,false),mocks:mocks.length,
    certified:certified,certified_at:p.certified_at||null,exempt:exempt,exempt_note:exempt?String(p.exempt.note||""):"",
    cleared:certified||exempt,leads_locked:c.gate_on&&!(certified||exempt)};
  if(full){out.lessons=p.lessons;}
  return out;
}
// "" when this partner may be dealt leads; otherwise where they are, in words (the refusal names it)
function crsGate(code){
  const c=crsR();if(!c.gate_on){return "";}
  const st=crsState(code,false);if(st.cleared){return "";}
  if(st.lessons_done<st.lessons_total){return st.lessons_done+" of "+st.lessons_total+" lessons done";}
  if(!st.quiz.passed_at){return "the final quiz isn't passed yet";}
  if(st.mock&&st.mock.status==="waiting"){return "the practice call is waiting for Station's review";}
  return "the practice call isn't passed yet";
}
function crsShuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function crsName(code){const a=sd.affiliates[code]||{};return a.name||code;}
'''

ACTIONS = r'''// ---- v4.74 (2026-10-21): the Station Partner course -- actions (helpers above `const action`) ----
if(action==="course_progress_get"||action==="cert_status"){
  // PURE READ: nothing here assigns to sd
  const code=sessionCode(b.token);
  if(!code){return [{json:{ok:false,error:"sign in first"}}];}
  return [{json:{ok:true,course:crsState(code,action==="course_progress_get")}}];
}
if(action==="course_progress_set"){
  const code=sessionCode(b.token);
  if(!code){return [{json:{ok:false,error:"not signed in"}}];}
  const k=crsR().key;
  if(!k){return [{json:{ok:false,error:"The course isn't open yet."}}];}
  if(b.version&&String(b.version)!==String(k.version)){
    return [{json:{ok:false,stale:true,error:"The course was just updated. Reload the page to get the newest lessons."}}];}
  const lid=String(b.lesson||"").slice(0,24);
  const key=(k.answers||{})[lid];
  if(!Array.isArray(key)){return [{json:{ok:false,error:"Station doesn't know that lesson. Reload the page."}}];}
  const p=crsMine(code,true);const at=nowISO();
  p.last={lesson:lid,at:at};
  if(!Array.isArray(b.answers)){return [{json:{ok:true,lesson:lid,course:crsState(code,true)}}];}
  if(b.answers.length!==key.length){return [{json:{ok:false,error:"Answer every question, then check."}}];}
  const right=key.map(function(x,i){return Number(b.answers[i])===Number(x);});
  const score=right.filter(Boolean).length,of=key.length,passed=score===of;
  const L=Object.assign({},p.lessons[lid]||{});
  L.tries=(L.tries||0)+1;L.last_at=at;L.score=score;L.of=of;L.best=Math.max(L.best||0,score);
  if(passed){L.passed_at=at;if(!L.done_at){L.done_at=at;}}
  p.lessons[lid]=L;
  return [{json:{ok:true,lesson:lid,right:right,score:score,of:of,passed:passed,done_at:L.done_at||null,course:crsState(code,true)}}];
}
if(action==="cert_quiz_start"){
  const code=sessionCode(b.token);
  if(!code){return [{json:{ok:false,error:"not signed in"}}];}
  const k=crsR().key;
  if(k&&b.version&&String(b.version)!==String(k.version)){
    return [{json:{ok:false,stale:true,error:"The course was just updated. Reload the page first."}}];}
  const pr=crsMine(code,false);
  if(pr.quiz&&pr.quiz.open&&(Date.parse(pr.quiz.open.exp)||0)>Date.now()){   // the same draw comes back after a reload
    return [{json:{ok:true,attempt:{id:pr.quiz.open.id,questions:pr.quiz.open.qs,expires:pr.quiz.open.exp},course:crsState(code,false)}}];}
  const block=crsQuizBlock(code,pr);
  if(block){return [{json:{ok:false,error:block,course:crsState(code,false)}}];}
  const pool=k.cert.quiz,ids=Object.keys(pool);
  const want=Math.max(1,Math.min(+k.cert.draw||20,ids.length));
  const byMod={};ids.forEach(function(q){const n=crsModN(pool[q]&&pool[q].module);(byMod[n]=byMod[n]||[]).push(q);});
  let pick=[];crsShuffle(Object.keys(byMod)).forEach(function(n){if(pick.length<want){pick.push(crsShuffle(byMod[n])[0]);}});
  crsShuffle(ids.filter(function(q){return pick.indexOf(q)<0;})).forEach(function(q){if(pick.length<want){pick.push(q);}});
  pick=crsShuffle(pick);
  const p=crsMine(code,true),now=Date.now();
  p.quiz.open={id:"qa-"+now.toString(36)+"-"+String(nonce()||"").slice(0,6),qs:pick,at:new Date(now).toISOString(),exp:new Date(now+CRS_ATTEMPT_MS).toISOString()};
  return [{json:{ok:true,attempt:{id:p.quiz.open.id,questions:pick,expires:p.quiz.open.exp},course:crsState(code,false)}}];
}
if(action==="cert_quiz_submit"){
  const code=sessionCode(b.token);
  if(!code){return [{json:{ok:false,error:"not signed in"}}];}
  const k=crsR().key;
  if(!k||!k.cert||!k.cert.quiz){return [{json:{ok:false,error:"The final quiz isn't open yet."}}];}
  const p=crsMine(code,true),open=p.quiz.open;
  if(!open||open.id!==String(b.attempt||"")){return [{json:{ok:false,error:"That quiz has ended. Start it again from the Learn tab.",course:crsState(code,false)}}];}
  if((Date.parse(open.exp)||0)<Date.now()){delete p.quiz.open;
    return [{json:{ok:false,error:"That quiz ran out of time (3 hours). Start it again; nothing was counted.",course:crsState(code,false)}}];}
  const ans=(b.answers&&typeof b.answers==="object")?b.answers:{};
  const missed={};let score=0;
  open.qs.forEach(function(q){const row=k.cert.quiz[q]||{};
    if(ans[q]!==undefined&&ans[q]!==null&&Number(ans[q])===Number(row.a)){score++;}else{missed[String(row.module||"")]=1;}});
  const of=open.qs.length,pct=of?Math.round(score*100/of):0,need=+k.cert.pass_pct||85,pass=pct>=need;
  const at=nowISO();
  const rec={id:open.id,at:at,score:score,of:of,pct:pct,pass:pass,missed:Object.keys(missed).filter(Boolean)};
  p.quiz.attempts.push(rec);if(p.quiz.attempts.length>30){p.quiz.attempts=p.quiz.attempts.slice(-30);}
  delete p.quiz.open;
  if(pass){
    p.quiz.passed_at=at;delete p.quiz.review;
    const sc=Array.isArray(k.cert.scenarios)?k.cert.scenarios.filter(Boolean):[];
    if(!p.scenario&&sc.length){p.scenario=String(sc[Math.floor(Math.random()*sc.length)]);}
    try{await snotify.call(this,code,"🎓 **Passed the final quiz** — "+crsName(code)+" scored "+score+" of "+of+" ("+pct+"%). Next: their practice call.");}catch(e){}
  }else{
    p.quiz.review={at:at,modules:rec.missed};
  }
  return [{json:{ok:true,result:{score:score,of:of,pct:pct,pass:pass,pass_pct:need,missed_modules:rec.missed},course:crsState(code,false)}}];
}
if(action==="mock_call_upload"){
  const code=sessionCode(b.token);
  if(!code){return [{json:{ok:false,error:"not signed in"}}];}
  const a=sd.affiliates[code];
  const k=crsR().key;
  if(!k||!k.cert){return [{json:{ok:false,error:"The practice call isn't open yet."}}];}
  const pr=crsMine(code,false);
  if(!(pr.quiz&&pr.quiz.passed_at)){return [{json:{ok:false,error:"Pass the final quiz first. Then record your practice call."}}];}
  if(pr.certified_at){return [{json:{ok:false,error:"You're already certified. Nothing more to send."}}];}
  const prev=crsMocksOf(code);const last=prev[prev.length-1];
  if(last&&last.status==="waiting"){return [{json:{ok:false,error:"Your practice call is already with Station. You'll hear back by email."}}];}
  const mime=String(b.mimetype||"").toLowerCase().split(";")[0].trim();
  const ext=CRS_MOCK_MIMES[mime];
  if(!ext){return [{json:{ok:false,error:"Send an audio recording (from this page, or a voice memo: m4a, mp3, webm, ogg or wav)."}}];}
  const filedata=String(b.filedata||"");
  if(!filedata){return [{json:{ok:false,error:"No recording came through. Try again."}}];}
  const bytes=Math.floor(filedata.length*0.75);
  if(bytes>CRS_MOCK_MAX_BYTES){return [{json:{ok:false,error:"That recording is over 8 MB. Record it again from this page; 6 minutes fits easily."}}];}
  if(bytes<2000){return [{json:{ok:false,error:"That recording is empty. Check your microphone and record again."}}];}
  const maxMin=+k.cert.max_minutes||6,secs=Math.max(0,Math.round(+b.seconds||0));
  if(secs>maxMin*60+20){return [{json:{ok:false,error:"That recording is "+Math.ceil(secs/60)+" minutes. The practice call is "+maxMin+" minutes at most: record it again."}}];}
  const id="mc-"+Date.now().toString(36)+"-"+String(nonce()||"").slice(0,8);
  let stored=null;
  try{stored=await this.helpers.httpRequest({method:"POST",url:CRS_STORE,headers:{"Content-Type":"application/json","X-Station-Broker":BSECRET},
    body:{id:id,code:code,mime:mime,ext:ext,seconds:secs,filedata:filedata},json:true,timeout:60000});}catch(e){stored={ok:false,error:String((e&&e.message)||e).slice(0,200)};}
  if(!stored||stored.ok!==true){
    try{await tg.call(this,"⚠️ Practice-call upload FAILED to reach Circle for "+code+" ("+crsName(code)+"): "+String((stored&&stored.error)||"no answer").slice(0,200));}catch(e){}
    return [{json:{ok:false,error:"Station couldn't save your recording just now. Keep it on your phone and try again in a few minutes."}}];
  }
  const c=crsW();const at=nowISO();
  const row={id:id,code:code,at:at,status:"waiting",scenario:pr.scenario||"",seconds:secs,bytes:bytes,mime:mime,ext:ext,round:prev.length+1};
  c.mocks.push(row);if(c.mocks.length>CRS_MOCK_KEEP){c.mocks=c.mocks.slice(-CRS_MOCK_KEEP);}
  try{await snotify.call(this,code,"🎙️ **Practice call waiting** — "+crsName(code)+" sent in their mock call ("+Math.max(1,Math.round(secs/60))+" min). Review it in Circle › Station › Partners › Course.");}catch(e){}
  try{await this.helpers.httpRequest({method:"POST",url:"http://circle:8790/api/notify",headers:{"Content-Type":"application/json"},
    body:{title:("Practice call to review: "+crsName(code)).slice(0,190),note:"Listen and mark the rubric. Passing it unlocks their leads.",
      tag:"AFFILIATE",biz:"station",nav:"station/partners/course"},json:true,timeout:8000});}catch(e){}
  return [{json:{ok:true,mock:crsMockOut(row,false),course:crsState(code,false)}}];
}
if(action==="course_key_set"){
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const kk=(b.key&&typeof b.key==="object")?b.key:null;
  if(!kk||!kk.version||!kk.answers||typeof kk.answers!=="object"){return [{json:{ok:false,error:"key must be {version, answers:{lessonId:[index,...]}, cert?}"}}];}
  const answers={};let bad="";
  Object.keys(kk.answers).slice(0,400).forEach(function(lid){const v=kk.answers[lid];
    if(!Array.isArray(v)||!v.length||v.some(function(x){return !(Number.isInteger(x)&&x>=0&&x<10);})){bad=bad||lid;return;}
    answers[String(lid).slice(0,24)]=v.slice(0,10);});
  if(bad){return [{json:{ok:false,error:"lesson "+bad+": answers must be a list of option numbers"}}];}
  const key={version:String(kk.version).slice(0,40),answers:answers,set_at:nowISO(),by:String(b.by||"founder").slice(0,40)};
  if(kk.cert&&typeof kk.cert==="object"){
    const cq=kk.cert.quiz||{},quiz={};
    Object.keys(cq).slice(0,300).forEach(function(q){const r=cq[q]||{};
      if(Number.isInteger(r.a)&&r.a>=0&&r.a<10){quiz[String(q).slice(0,24)]={a:r.a,module:String(r.module||"").slice(0,40)};}else{bad=bad||q;}});
    if(bad){return [{json:{ok:false,error:"quiz question "+bad+" has no answer number"}}];}
    const pp=+kk.cert.pass_pct||85;
    key.cert={quiz:quiz,pass_pct:Math.min(100,Math.max(50,pp)),draw:Math.max(1,Math.min(+kk.cert.draw||20,Object.keys(quiz).length||1)),
      max_minutes:Math.min(15,Math.max(1,+kk.cert.max_minutes||6)),good_min:Math.max(0,+kk.cert.good_min||8),
      scenarios:(Array.isArray(kk.cert.scenarios)?kk.cert.scenarios:[]).map(function(s){return String(s).slice(0,40);}).slice(0,20),
      rubric:(Array.isArray(kk.cert.rubric)?kk.cert.rubric:[]).map(function(s){return String(s).slice(0,40);}).slice(0,30),
      scenarios_good:(kk.cert.scenarios_good&&typeof kk.cert.scenarios_good==="object")?kk.cert.scenarios_good:{}};
  }
  crsW().key=key;
  return [{json:{ok:true,version:key.version,lessons:Object.keys(answers).length,quiz:key.cert?Object.keys(key.cert.quiz).length:0,
    scenarios:key.cert?key.cert.scenarios.length:0,rubric:key.cert?key.cert.rubric.length:0}}];
}
if(action==="course_admin"){
  // PURE READ (Circle > Station > Partners > Course)
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const c=crsR();
  const partners=Object.keys(sd.affiliates||{}).filter(function(code){const a=sd.affiliates[code];return a&&partnerOnly(a)&&(a.status==="active"||a.status==="pending");})
    .map(function(code){const a=sd.affiliates[code];const st=crsState(code,true);
      const ex=(c.p[code]&&c.p[code].exempt)||null;
      return {code:code,name:a.name||code,email:a.email||"",status:a.status,approved:a.approved||a.approvedAt||null,course:st,exempt_by:ex?ex.by||"":"",exempt_at:ex?ex.at||null:null};});
  const k=c.key;
  return [{json:{ok:true,gate_on:c.gate_on,gate_at:c.gate_at,gate_by:c.gate_by,
    key:k?{version:k.version,set_at:k.set_at,lessons:Object.keys(k.answers||{}).length,cert:!!k.cert,
      rubric:k.cert?k.cert.rubric:[],good_min:k.cert?k.cert.good_min:8,pass_pct:k.cert?k.cert.pass_pct:85,scenarios_good:k.cert?k.cert.scenarios_good:{}}:null,
    partners:partners,mocks:c.mocks.slice(-200).reverse().map(function(m){const o=crsMockOut(m,true);o.name=crsName(m.code);return o;})}}];
}
if(action==="mock_call_list"){
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const want=String(b.status||"").toLowerCase();
  const rows=crsR().mocks.filter(function(m){return m&&(!want||want==="all"||m.status===want);}).slice(-200).reverse()
    .map(function(m){const o=crsMockOut(m,true);o.name=crsName(m.code);const st=crsState(m.code,false);o.quiz_best=st.quiz.best_pct;return o;});
  return [{json:{ok:true,mocks:rows}}];
}
if(action==="mock_call_review"){
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const c=crsW(),k=c.key;
  const m=c.mocks.find(function(x){return x&&x.id===String(b.id||"");});
  if(!m){return [{json:{ok:false,error:"Station doesn't know that practice call."}}];}
  if(m.status!=="waiting"){return [{json:{ok:false,error:"This call was already marked "+m.status+(m.review&&m.review.by?" by "+m.review.by:"")+"."}}];}
  const decision=String(b.decision||"").toLowerCase();
  if(decision!=="pass"&&decision!=="redo"){return [{json:{ok:false,error:"Say pass or redo."}}];}
  const want=(k&&k.cert&&k.cert.rubric&&k.cert.rubric.length)?k.cert.rubric:Object.keys(b.items||{}).slice(0,30);
  const given=(b.items&&typeof b.items==="object")?b.items:{};
  const items={};let good=0,redo=0,miss="",nonote="";
  want.forEach(function(id){const r=given[id]||{};const mark=String(r.mark||"").toLowerCase();
    if(["good","work","redo"].indexOf(mark)<0){miss=miss||id;return;}
    const note=String(r.note||"").replace(/\s+/g," ").trim().slice(0,600);
    if(mark!=="good"&&note.length<3){nonote=nonote||id;}
    items[id]={mark:mark,note:note};if(mark==="good"){good++;}if(mark==="redo"){redo++;}});
  if(miss){return [{json:{ok:false,error:"Mark every rubric line (good, needs work or redo). Missing: "+miss+"."}}];}
  if(nonote){return [{json:{ok:false,error:"Every line that isn't good needs a note the partner can act on. Missing: "+nonote+"."}}];}
  const gmin=(k&&k.cert&&k.cert.good_min!=null)?+k.cert.good_min:8;
  if(decision==="pass"&&redo){return [{json:{ok:false,error:"A line is marked redo, so the call is a redo."}}];}
  if(decision==="pass"&&good<gmin){return [{json:{ok:false,error:"A pass needs at least "+gmin+" lines marked good ("+good+" now)."}}];}
  const at=nowISO(),by=String(b.by||"Station").slice(0,40),note=String(b.note||"").replace(/\s+/g," ").trim().slice(0,800);
  m.status=decision;m.review={at:at,by:by,items:items,note:note,good:good,redo:redo};
  const code=m.code,a=sd.affiliates[code]||{};
  const p=crsMine(code,true);
  const NN="\n\n";
  if(decision==="pass"){
    p.certified_at=at;
    pwEvent(code,"course","You're certified","Station passed your practice call. Station can now send you businesses to call.");
    try{await pwMail.call(this,code,a,"course","You're a certified Station partner",
      "Hi "+String(a.name||"").split(" ")[0]+","+NN+"Station listened to your practice call and passed it. You're certified, so Station can now send you businesses to call."+
      (note?(NN+"Station's note: "+note):"")+NN+"Partner World: https://partners.station.solutions"+NN+"Station");}catch(e){}
  }else{
    const lines=want.filter(function(id){return items[id]&&items[id].mark!=="good";}).map(function(id){return "- "+id+": "+items[id].note;});
    pwEvent(code,"course","Your practice call: one more take","Station listened and has notes for you. Read them on the Learn tab, then record it again.");
    try{await pwMail.call(this,code,a,"course","Your practice call: notes from Station",
      "Hi "+String(a.name||"").split(" ")[0]+","+NN+"Station listened to your practice call. It's close; record it once more with these notes:"+NN+lines.join("\n")+
      (note?(NN+note):"")+NN+"The notes are on the Learn tab too: https://partners.station.solutions/#learn"+NN+"Station");}catch(e){}
  }
  return [{json:{ok:true,mock:crsMockOut(m,true),course:crsState(code,false)}}];
}
if(action==="course_gate_set"){
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const on=(b.on===true||b.on===1||b.on==="1"||b.on==="true");
  const c=crsW();
  if(on&&!(c.key&&c.key.cert)){return [{json:{ok:false,error:"Load the course key (with the certification) before turning the gate on."}}];}
  c.gate_on=on;c.gate_at=nowISO();c.gate_by=String(b.by||"founder").slice(0,40);
  try{await tg.call(this,"🎓 Course gate "+(on?"ON: leads go only to certified or exempt partners":"OFF: leads go to every active partner")+" ("+c.gate_by+")");}catch(e){}
  return [{json:{ok:true,gate_on:c.gate_on,gate_at:c.gate_at,gate_by:c.gate_by}}];
}
if(action==="course_exempt_set"){
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const code=String(b.code||"").toLowerCase().replace(/[^a-z0-9-]/g,"");
  if(!code||!sd.affiliates[code]){return [{json:{ok:false,error:"unknown code"}}];}
  const on=(b.on===true||b.on===1||b.on==="1"||b.on==="true");
  const p=crsMine(code,true);
  p.exempt={on:on,at:nowISO(),by:String(b.by||"founder").slice(0,40),note:String(b.note||"").replace(/\s+/g," ").trim().slice(0,300)};
  return [{json:{ok:true,code:code,course:crsState(code,false)}}];
}
'''

ME_OLD = '''ref:pwRef(code),claims_open:pwClaimsOpen(code), // v4.65'''
ME_NEW = ME_OLD + '''
    course:crsState(code,false), // v4.74'''
VIEW_OLD = '''team_view:1,team_partner:1,book_slots:1,st_slots:1,lead_thread:1,logout:1};'''
VIEW_NEW = '''team_view:1,team_partner:1,book_slots:1,st_slots:1,lead_thread:1,logout:1,course_progress_get:1,cert_status:1};   // v4.74: + course reads'''
LOG_OLD = '''training_set:"Changed a team member's training",'''
LOG_NEW = LOG_OLD + '''cert_quiz_submit:"Took the final quiz",mock_call_upload:"Sent in their practice call",'''
ASSIGN_OLD = '''  const list=Array.isArray(b.leads)?b.leads:null;'''
ASSIGN_NEW = '''  {const _cg=crsGate(code);   // v4.74: while the course gate is on, Station deals only to certified (or exempt) partners
    if(_cg){return [{json:{ok:false,course_locked:true,error:(a.name||code)+" hasn't finished the Station Partner course yet ("+_cg+"). Mark them exempt in Partners › Course, or wait until they pass."}}];}}
''' + ASSIGN_OLD
MORE_OLD = '''  const firstAsk=!cnt.dealt_total;'''
MORE_NEW = '''  {const _cg=crsGate(code);   // v4.74: the course unlocks leads
    if(_cg){return [{json:{ok:false,course_locked:true,error:"Finish the Station Partner course to unlock your leads ("+_cg+")."}}];}}
''' + MORE_OLD

ACTION_OLD = '''const action=String(b.action||"").toLowerCase();'''
END_OLD = '''// ---- /v4.44
return [{json:{ok:false,error:"unknown action"}}];'''

EDITS = [
    (NEEDS, "// v4.74 (2026-10-21): the Station Partner course -- course_progress_get/set, cert_quiz_start/submit, mock_call_upload\n"
            "//        (stored on Circle), course_key_set, course_admin, mock_call_list/review, course_gate_set (OFF by default),\n"
            "//        course_exempt_set; cc_assign/cc_more refuse an uncertified partner while the gate is on; me.course.\n" + NEEDS, 1),
    (ACTION_OLD, HELPERS + ACTION_OLD, 1),
    (END_OLD, ACTIONS + END_OLD, 1),
    (ME_OLD, ME_NEW, 1),
    (VIEW_OLD, VIEW_NEW, 1),
    (LOG_OLD, LOG_NEW, 1),
    (ASSIGN_OLD, ASSIGN_NEW, 1),
    (MORE_OLD, MORE_NEW, 1),
]


def patched(code):
    if NEEDS not in code:
        sys.exit("the live engine has no v4.72 line: refusing")
    for old, new, n in EDITS:
        c = code.count(old)
        if c != n:
            sys.exit("ANCHOR count=%d (expected %d): %r" % (c, n, old[:110]))
        code = code.replace(old, new)
    return code


def parse_check(code):
    fd, chk = tempfile.mkstemp(suffix=".js", prefix="_v474_check_")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(code)
    try:
        r = subprocess.run(["node", "-e", "const fs=require('fs'),vm=require('vm');new vm.Script('(async function(){'+fs.readFileSync(process.argv[1],'utf8')+'\\n})');console.log('parse ok')", chk],
                           capture_output=True, text=True)
    finally:
        os.remove(chk)
    if r.returncode != 0:
        sys.exit("PARSE FAILED:\n" + r.stderr)
    return r.stdout.strip()


def show_diff(before, after):
    d = difflib.unified_diff(before.splitlines(True), after.splitlines(True), "jsCode (live)", "jsCode (v4.74)", n=2)
    sys.stdout.writelines(d)
    print()


SETTINGS_OK = {"executionOrder", "saveManualExecutions", "callerPolicy", "errorWorkflow", "timezone",
               "saveExecutionProgress", "saveDataErrorExecution", "saveDataSuccessExecution", "executionTimeout"}


def main():
    if "--offline" in sys.argv:
        i = sys.argv.index("--offline")
        src, dst = sys.argv[i + 1], sys.argv[i + 2]
        code = open(src, encoding="utf-8").read()
        if MARK in code:
            sys.exit("already applied")
        out = patched(code)
        print(parse_check(out))
        open(dst, "w", encoding="utf-8").write(out)
        print("wrote", dst)
        return
    cfg = json.load(open(os.path.expanduser(os.path.join("~", ".station", "secrets", "n8n.json")), encoding="utf-8"))
    base, key = cfg["url"].rstrip("/"), cfg["api_key"]

    def call(method, path, body=None):
        req = urllib.request.Request(base + "/api/v1" + path, method=method,
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"X-N8N-API-KEY": key, "Content-Type": "application/json", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r)

    wf = call("GET", "/workflows/" + WF)
    if "--export" in sys.argv:
        dst = sys.argv[sys.argv.index("--export") + 1]
        live_code = next(n for n in wf["nodes"] if n["name"] == NODE)["parameters"]["jsCode"]
        with open(dst, "w", encoding="utf-8") as f:
            f.write(live_code)
        print("exported", len(live_code), "chars to", dst, "| v4.74 live:", MARK in live_code)
        return
    node = next(n for n in wf["nodes"] if n["name"] == NODE)
    before = node["parameters"]["jsCode"]
    if MARK in before:
        sys.exit("already applied (v4.74 marker is live): refusing")
    bdir = os.path.expanduser(os.path.join("~", ".station", "backups"))
    os.makedirs(bdir, exist_ok=True)
    bak = os.path.join(bdir, "affiliate-engine-pre-v474-%s.json" % time.strftime("%Y%m%d-%H%M%S"))
    with open(bak, "w", encoding="utf-8") as f:
        json.dump(wf, f)
    os.chmod(bak, 0o600)    # the workflow export carries staticData (partner records)
    print("backup:", bak, "| versionId", wf.get("versionId"), "| updatedAt", wf.get("updatedAt"))
    after = patched(before)
    print(parse_check(after))
    if "--apply" not in sys.argv:
        show_diff(before, after)
        print("DRY RUN ok (%d -> %d bytes). Re-run with --apply to write." % (len(before), len(after)))
        return
    node["parameters"]["jsCode"] = after
    call("PUT", "/workflows/" + WF, {"name": wf["name"], "nodes": wf["nodes"], "connections": wf["connections"],
                                      "settings": {k: v for k, v in (wf.get("settings") or {}).items() if k in SETTINGS_OK}})
    call("POST", "/workflows/%s/deactivate" % WF)
    call("POST", "/workflows/%s/activate" % WF)
    live_wf = call("GET", "/workflows/" + WF)
    live = next(n for n in live_wf["nodes"] if n["name"] == NODE)["parameters"]["jsCode"]
    print("active:", live_wf.get("active"), "| v4.74 live:", MARK in live, "| byte-identical:", live == after)
    print("roll back: re-PUT the node jsCode from", bak)


if __name__ == "__main__":
    main()
