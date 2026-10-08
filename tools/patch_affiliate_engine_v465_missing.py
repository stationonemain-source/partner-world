"""Affiliate Engine v4.65 (2026-10-07): Partner World's missing pieces (Circle: "build the Partner World missing pieces").

What it adds to n8n workflow kuC7urcDYI0A32w7, node "Affiliate Logic" (anchors are read against live v4.64):

 1. Referral numbers (agreement 3.1(a), 10.3): `me` gains ref {link, counting, visits, visits_30d, forms, kinds, last_at,
    kept_from} from sd.attributions (the website's ?ref=<code> visits and form fills, action `attribute`), and claims_open.
    `attribute` stamps sd.ref_seen_at the first time a visit arrives, so Partner World can say "not counted yet" honestly
    until the site's beacon actually reaches the engine (see the build report: Chrome drops it today).
 2. What's new (agreement 3.1(d)): partner pw_news {token} (pure read) -> the partner's engine events (client purchases and
    setups from client_alert, Station's notes posted with pw_event_add), their bookings (sd.cal_bookings), their Add-a-client
    requests and Station's answers, and the time Station last emailed them (one GHL conversation read; mail:false skips it).
    client_alert now records an event and emails the partner on a purchase/setup through pwMail (ceiling: 12 notices per
    partner per Chicago day, 150 for all partners; ledger sd.pw_mail_log written before the send). pbAnnounce (a booking on
    the partner's own calendar) sends through pwMail too. Admin pw_event_add {secret, code, kind, title, text}.
 3. Add a client (agreement 6.2): partner client_claim {token, business, name?, email, phone?, product, note?, lead?} ->
    a PENDING claim (sd.client_claims; 10 open / 5 a day per partner; duplicates refused without saying whose) + Station's
    Discord. Admin client_claims {secret, status?} (pure read) and client_claim_decide {secret, id, decision:accept|decline,
    reason?, bundle?, products?}: accept tags the HQ contact aff-<code> + client (never another partner's client, the same
    rule as cc_accept), records book_since, and tells the partner; decline records the reason and tells the partner.
    client_add (a partner writing straight into their own book) is CLOSED: it refuses and points at Add a client.
 4. Calls with Station (agreement 4.2: support is Station's): partner st_slots {token, for:me|client} and st_book {token,
    for, contactId (for:client, re-derived with ownedClient), start, topic} on Station's own calendar ("Station Support Call",
    unT6rF2jVTabl1ki7NUs, both kinds; admin st_cal_set {secret, me?, client?} points either at another HQ calendar).
    At most 3 upcoming per partner, 2 h to 30 days ahead. Recorded in sd.cal_bookings (who station-self / station-client),
    Station's Discord gets the topic, the partner gets a ceilinged email with add-to-calendar links.
 5. lead_book (a call on the partner's own calendar) emails the BUSINESS a plain-text confirmation from the cold lane,
    From "Station Team <hello@send.station.solutions>" (never main@), no link, the time in the lead's time zone (their state)
    else the partner's. Refused for Do-not-call, GHL DND / opt-out tags, no email. Ceilings: 25 per partner per Chicago day,
    3 per address per 7 days; ledger sd.lb_mail_log written before the send. lead_book also keeps an email the partner typed
    for a business that has none (b.email), and answers lead_mail {sent, why, to, when}.
 6. taxform_submit takes type W-9 or W-8BEN only (stored on the taxform record by Finish Upload, as before).

Run (from the Mac or the PC; needs ~/.station/secrets/n8n.json):
  python3 patch_affiliate_engine_v465_missing.py              # DRY RUN: backup + parse check + unified diff of jsCode
  python3 patch_affiliate_engine_v465_missing.py --apply      # write, deactivate/activate, read back
  python3 patch_affiliate_engine_v465_missing.py --export live.js        # read only: the live jsCode to a file
  python3 patch_affiliate_engine_v465_missing.py --offline live.js v465.js && node affiliate_engine_v465_sandbox.js v465.js
                                                                         # no network: patch a copy, run the sandbox
Idempotent: refuses when the v4.65 marker is already live. Fails loudly if any anchor is not found exactly as expected.
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
MARK = 'if(action==="pw_news"){'
NEEDS = '// v4.64 (2026-10-07): a Partner World request for an email that already has an account alerts Station'

# ------------------------------------------------------------------------------------------------ helpers (top level)
HELPERS = r'''// ---- v4.65 (2026-10-07): Partner World's missing pieces (Circle: "fill in those missing pieces"). Declared above every action.
// pw_news (What's new), me.ref (referral numbers, agreement 3.1(a)/10.3), client_claim -> Station accepts or declines
// (agreement 6.2: a client joins the Book when Station accepts; client_add is closed), st_slots/st_book (calls with Station on
// Station's own calendar, agreement 4.2), a booking confirmation to the lead from the cold lane (lead_book), ceilinged notice
// emails to partners (pwMail), tax forms that say which form they are (W-9 / W-8BEN), admin pw_event_add / st_cal_set.
const PW_EV_KEEP=400;          // engine events kept (all partners); pw_news shows a partner their newest 60
const PW_MAIL_PER_DAY=12;      // notice emails to ONE partner per Chicago day (bookings, purchases, Station's answers)
const PW_MAIL_ALL_DAY=150;     // notice emails to all partners per Chicago day
const PW_MAIL_KEEP=1500;
const LB_PER_DAY=25;           // booking confirmations to leads, per partner per Chicago day
const LB_PER_LEAD_WEEK=3;      // to one address in 7 days
const LB_FROM="Station Team <hello@send.station.solutions>";   // the cold lane (Circle 10-07: main@ is for paying clients only)
const ST_CAL_DEFAULT={me:"unT6rF2jVTabl1ki7NUs",client:"unT6rF2jVTabl1ki7NUs"};   // "Station Support Call" (HQ, round robin)
const ST_UPCOMING_MAX=3;       // calls with Station a partner can have booked ahead
const CLAIM_OPEN_MAX=10, CLAIM_PER_DAY=5, CLAIM_KEEP=2000;
const CLAIM_BUNDLES=["answer","getfound","followup","core","pro","custom"];
const PW_TZ_WORDS={"America/New_York":"Eastern","America/Detroit":"Eastern","America/Indiana/Indianapolis":"Eastern","America/Chicago":"Central",
  "America/Denver":"Mountain","America/Boise":"Mountain","America/Phoenix":"Arizona","America/Los_Angeles":"Pacific","America/Anchorage":"Alaska",
  "Pacific/Honolulu":"Hawaii"};
let _PWN=0;
function pwTzWords(tz){return PW_TZ_WORDS[tz]?(PW_TZ_WORDS[tz]+" time"):String(tz||"").replace(/_/g," ");}
function pwEvent(code,kind,title,text,extra){
  if(!code||!sd.affiliates[code]){return null;}
  const ev=Object.assign({id:"ev-"+Date.now().toString(36)+"-"+String(nonce()||"").slice(0,6)+"-"+(++_PWN),code:code,
    kind:String(kind||"note").slice(0,20),title:String(title||"").slice(0,160),text:String(text||"").slice(0,400),at:nowISO()},extra||{});
  const a=Array.isArray(sd.pw_events)?sd.pw_events:[];a.push(ev);
  sd.pw_events=a.length>PW_EV_KEEP?a.slice(-PW_EV_KEEP):a;
  return ev;
}
// The one way an engine notice reaches a partner's inbox: a ceiling per partner and for everyone, per Chicago day, and a
// ledger row written before the send. Returns "sent" | "capped" | "no_email" | "failed". Never throws.
async function pwMail(code,a,kind,subject,text){
  try{
    const to=String((a&&a.email)||"").trim().toLowerCase();
    if(!validEmail(to)){return "no_email";}
    const today=ccToday();
    const log=Array.isArray(sd.pw_mail_log)?sd.pw_mail_log:[];
    const live=log.filter(function(r){return r&&r.day===today&&r.status!=="failed";});
    if(live.length>=PW_MAIL_ALL_DAY||live.filter(function(r){return r.code===code;}).length>=PW_MAIL_PER_DAY){
      try{await tg.call(this,"Partner notice email held by the daily ceiling ("+code+"): "+String(subject||"").slice(0,120));}catch(e){}
      return "capped";
    }
    const row={code:code,kind:String(kind||"").slice(0,20),subject:String(subject||"").slice(0,160),day:today,at:nowISO(),status:"sending"};
    log.push(row);sd.pw_mail_log=log.length>PW_MAIL_KEEP?log.slice(-PW_MAIL_KEEP):log;
    const sent=await sendMail.call(this,to,(a.name||code),subject,text);
    row.status=sent?"sent":"failed";
    return sent?"sent":"failed";
  }catch(e){return "failed";}
}
function pwRef(code){
  const all=Array.isArray(sd.attributions)?sd.attributions:[];
  const since=Date.now()-30*CC_DAY;const kinds={};let v=0,v30=0,f=0,last="";
  all.forEach(function(x){
    if(!x||x.code!==code){return;}
    const k=String(x.kind||"visit").slice(0,32);kinds[k]=(kinds[k]||0)+1;
    if(k==="visit"){v++;if((Date.parse(x.at)||0)>=since){v30++;}}else{f++;}
    if(String(x.at||"")>last){last=String(x.at||"");}
  });
  return {link:"https://www.station.solutions/?ref="+code,counting:!!sd.ref_seen_at,visits:v,visits_30d:v30,forms:f,kinds:kinds,
    last_at:last||null,kept_from:(all.length?(String((all[0]||{}).at||"")||null):null)};
}
function pwClaims(){return Array.isArray(sd.client_claims)?sd.client_claims:[];}
function pwClaimView(c){return {id:c.id,business:c.business,name:c.name||"",email:c.email,phone:c.phone||"",product:c.product||"",
  note:c.note||"",lead:c.lead||"",at:c.at,status:c.status,decided_at:c.decided_at||null,reason:c.reason||""};}
function pwClaimsOpen(code){return pwClaims().filter(function(c){return c&&c.code===code&&c.status==="pending";}).length;}
function stCal(forWho){const o=(sd.st_cal&&typeof sd.st_cal==="object")?sd.st_cal:{};return String(o[forWho]||ST_CAL_DEFAULT[forWho]||"");}
function stUpcoming(code,now){
  return (sd.cal_bookings||[]).filter(function(x){return x&&x.code===code&&/^station-/.test(String(x.who||""))&&(Date.parse(x.start||"")||0)>now;});
}
// The business a partner booked hears from Station: plain text, no link, from the cold lane, in their own time zone.
// Returns {sent:true,to,when} or {sent:false,why}. Never throws; a failed confirmation never undoes the booking.
async function lbConfirm(code,a,l,start,cid,tok){
  try{
    const to=String((l&&l.email)||"").trim().toLowerCase();
    if(!validEmail(to)){return {sent:false,why:"no_email"};}
    if(String(l.outcome||"")==="dnc"||(l.blocks&&l.blocks.dnc)||pmDncHit(to,l.phone)){return {sent:false,why:"dnc"};}
    if(!cid||!tok){return {sent:false,why:"no_contact"};}
    const now=Date.now(),today=ccToday();
    const log=Array.isArray(sd.lb_mail_log)?sd.lb_mail_log:[];
    if(log.filter(function(r){return r&&r.code===code&&r.day===today&&r.status!=="failed";}).length>=LB_PER_DAY){return {sent:false,why:"capped"};}
    if(log.filter(function(r){return r&&r.to===to&&r.status!=="failed"&&now-(Date.parse(r.at)||0)<7*CC_DAY;}).length>=LB_PER_LEAD_WEEK){return {sent:false,why:"capped"};}
    let ct=null;
    try{const c=await hget.call(this,GHL+"/contacts/"+encodeURIComponent(cid),tok);ct=(c&&c.contact)||null;}catch(e){ct=null;}
    if(!ct){return {sent:false,why:"unreadable"};}
    const tags=(ct.tags||[]).map(function(x){return String(x).toLowerCase();});
    const ds=(ct.dndSettings&&typeof ct.dndSettings==="object")?ct.dndSettings:{};
    const es=String(((ds.Email||{}).status)||"").toLowerCase();
    if(ct.dnd===true||es==="active"||es==="permanent"||tags.some(function(t){return PM_SUPPRESS_TAGS.indexOf(t)>=0;})){return {sent:false,why:"opted_out"};}
    const leadTz=PB_STATE_TZ[String(l.state||"").toUpperCase()]||"";
    const tz=leadTz||ccTzOf(a);
    const ms=Date.parse(start);
    const when=fmtWhen(ccLocalIso(ms,tz))+" "+pwTzWords(tz);
    const first=pmFirst(a);
    const N1=String.fromCharCode(10),NN=String.fromCharCode(10,10);
    const subject="Your call with "+first+" from Station";
    const text="Hi,"+NN+first+", an independent partner with Station, booked a call with you for "+when+"."+NN+
      first+" will call you"+(l.phone?(" at "+String(l.phone)):"")+" then."+NN+
      "If that time doesn't work, reply to this email and Station will let "+first+" know."+NN+"Station Team"+N1+PM_ADDR;
    const row={code:code,lead:String(l.id||""),to:to,cid:cid,start:String(start).slice(0,40),day:today,at:nowISO(),status:"sending"};
    log.push(row);sd.lb_mail_log=log.length>2000?log.slice(-2000):log;
    const send=async function(withHtml){
      const p={type:"Email",contactId:cid,subject:subject,message:text,emailFrom:LB_FROM,emailTo:to};
      if(withHtml){p.html="<div style=\"white-space:pre-wrap\">"+esc(text)+"</div>";}
      const r=await this.helpers.httpRequest({method:"POST",url:GHL+"/conversations/messages",headers:H(tok),body:p,json:true,
        ignoreHttpStatusErrors:true,returnFullResponse:true});
      let x=(r&&r.body)||{};if(typeof x==="string"){try{x=JSON.parse(x);}catch(e){x={};}}
      return {sc:Number(r&&r.statusCode)||0,x:x};
    };
    let res=null;
    try{res=await send.call(this,false);if(res.sc===400||res.sc===422){res=await send.call(this,true);}}
    catch(e){res={sc:0,x:{error:String((e&&e.message)||e).slice(0,200)}};}
    if(res.sc<200||res.sc>=300){
      row.status="failed";row.err=(String(res.sc)+" "+JSON.stringify(res.x||{})).slice(0,200);
      try{await tg.call(this,"lead_book: the booking confirmation to a lead failed ("+res.sc+") for "+code);}catch(e){}
      return {sent:false,why:"failed"};
    }
    row.status="sent";row.mid=String((res.x&&res.x.messageId)||"");
    return {sent:true,to:to,when:when};
  }catch(e){return {sent:false,why:"failed"};}
}
'''

# ------------------------------------------------------------------------------------------------ new actions
ACTIONS = r'''// ---- v4.65 (2026-10-07): Partner World's missing pieces -- actions (helpers above `const action`) ----
if(action==="pw_news"){
  // PURE READ (AE-3): assigns nothing to sd. The partner's What's new: engine events, bookings, Add-a-client requests,
  // and when Station last emailed them (mail:false skips that GHL read).
  const g=pwGate(b);if(g.err){return [{json:{ok:false,error:g.err}}];}
  const code=g.code,a=g.a;
  const events=(Array.isArray(sd.pw_events)?sd.pw_events:[]).filter(function(e){return e&&e.code===code;}).slice(-60).reverse()
    .map(function(e){return {id:e.id,kind:e.kind,title:e.title,text:e.text,at:e.at};});
  const bookings=(sd.cal_bookings||[]).filter(function(x){return x&&x.code===code&&x.start;}).slice(-40).reverse()
    .map(function(x){return {id:x.id,start:x.start,who:x.who||"",label:x.label||"",booked:x.booked||"",topic:x.topic||""};});
  const claims=pwClaims().filter(function(c){return c&&c.code===code;}).slice(-40).reverse().map(pwClaimView);
  let wrote=null,wroteRead="skipped";
  if(b.mail!==false){
    wroteRead="ok";
    try{
      const tok=await brokerKey.call(this,HQ);
      if(!tok){throw new Error("no token");}
      let cid=String(a.ghl_cid||"");
      const em=String(a.email||"").trim().toLowerCase();
      if(!cid&&em){
        let d=await hget.call(this,GHL+"/contacts/search/duplicate?locationId="+encodeURIComponent(HQ)+"&email="+encodeURIComponent(em),tok);
        if(typeof d==="string"){try{d=JSON.parse(d);}catch(e){d={};}}
        cid=String((d&&d.contact&&d.contact.id)||"");
      }
      if(cid){
        const s=await hget.call(this,GHL+"/conversations/search?locationId="+encodeURIComponent(HQ)+"&contactId="+encodeURIComponent(cid),tok);
        ((s&&s.conversations)||[]).forEach(function(c){
          const t=Number(c.lastMessageDate)||Date.parse(c.lastMessageDate||"")||0;
          const ty=String(c.lastMessageType||"").toUpperCase();
          if(String(c.lastMessageDirection||"").toLowerCase()==="outbound"&&t&&(!ty||ty==="TYPE_EMAIL")&&(!wrote||t>Date.parse(wrote.at))){
            wrote={at:new Date(t).toISOString()};}
        });
      }
    }catch(e){wrote=null;wroteRead="failed";}
  }
  return [{json:{ok:true,events:events,bookings:bookings,claims:claims,station_wrote:wrote,station_wrote_read:wroteRead,ref:pwRef(code),
    claims_open:pwClaimsOpen(code)}}];
}
if(action==="client_claim"){
  // agreement 6.2: a partner says they closed a business; it joins their book only when Station accepts it
  const g=pwGate(b);if(g.err){return [{json:{ok:false,error:g.err}}];}
  const code=g.code,a=g.a;const now=Date.now();
  const biz=String(b.business||"").replace(/\s+/g," ").trim().slice(0,120);
  const name=String(b.name||"").replace(/\s+/g," ").trim().slice(0,80);
  const email=String(b.email||"").trim().toLowerCase().slice(0,160);
  const phone=String(b.phone||"").replace(/\s+/g," ").trim().slice(0,24);
  const product=String(b.product||"").trim().toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,40);
  const note=String(b.note||"").replace(/\r\n/g,"\n").trim().slice(0,600);
  const lead=String(b.lead||"").slice(0,120);
  if(!biz){return [{json:{ok:false,error:"Add the business name."}}];}
  if(!validEmail(email)){return [{json:{ok:false,error:"Add the email they pay Station with. Station matches their payments to you by it."}}];}
  if(phone&&ccDigits10(phone).length!==10){return [{json:{ok:false,error:"That phone number doesn't look right. Leave it empty or use 10 digits."}}];}
  if(!product){return [{json:{ok:false,error:"Pick what they bought."}}];}
  if(CLAIM_BUNDLES.indexOf(product)<0&&product!=="website"&&product!=="unsure"){
    const cat=await catalogue.call(this);
    if(!cat||!cat.products){return [{json:{ok:false,error:"Station's product list didn't load just now. Try again in a minute."}}];}
    if(!cat.products[product]){return [{json:{ok:false,error:"Pick a product from the list."}}];}
  }
  if(lead&&!(sd.leads||[]).some(function(x){return x&&x.id===lead&&x.code===code;})){return [{json:{ok:false,error:"That business isn't on your list."}}];}
  const list=pwClaims();const mine=list.filter(function(c){return c&&c.code===code;});
  if(mine.filter(function(c){return c.status==="pending";}).length>=CLAIM_OPEN_MAX){
    return [{json:{ok:false,error:"You have "+CLAIM_OPEN_MAX+" clients waiting for Station. Station answers each one; add more once it has."}}];}
  const today=ccToday();
  if(mine.filter(function(c){return ccDayOf(Date.parse(c.at)||0)===today;}).length>=CLAIM_PER_DAY){
    return [{json:{ok:false,error:"That's "+CLAIM_PER_DAY+" clients today. Add the rest tomorrow, or Message Station."}}];}
  const dup=list.find(function(c){return c&&c.status==="pending"&&c.email===email;});
  if(dup){return [{json:{ok:false,error:(dup.code===code?"You already asked Station to add this client. Station will answer it here.":"Station is already looking at this business. Message Station and say how you closed it.")}}];}
  if(pmDncHit(email,phone)){return [{json:{ok:false,error:"This business asked not to be contacted, so it can't be added."}}];}
  const c={id:"cl-"+now.toString(36)+"-"+String(nonce()||"").slice(0,6),code:code,business:biz,name:name,email:email,phone:phone,
    product:product,note:note,lead:lead,at:nowISO(),status:"pending"};
  list.push(c);sd.client_claims=list.length>CLAIM_KEEP?list.slice(-CLAIM_KEEP):list;
  const NL=String.fromCharCode(10);
  try{await snotify.call(this,code,"**Add a client** -- "+String(a.name||code)+" says they closed "+biz+" <"+email+"> ("+product+"). Accept or decline it in Circle > Partners > Needs you."+(note?(NL+"> "+note.slice(0,400).replace(/\n/g,NL+"> ")):""));}catch(e){}
  return [{json:{ok:true,claim:pwClaimView(c),claims_open:pwClaimsOpen(code)}}];
}
if(action==="client_claims"){
  // admin, PURE READ: Circle's Partners > Needs you lists the pending ones
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const st=String(b.status||"").toLowerCase();
  const rows=pwClaims().filter(function(c){return c&&(!st||c.status===st);}).slice(-Math.min(500,Number(b.limit)||200)).reverse()
    .map(function(c){const a=sd.affiliates[c.code]||{};return Object.assign(pwClaimView(c),{code:c.code,partner:String(a.name||c.code),
      partner_email:String(a.email||""),partner_status:String(a.status||""),contact_id:c.contact_id||null,decided_by:c.decided_by||""});});
  return [{json:{ok:true,claims:rows}}];
}
if(action==="client_claim_decide"){
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const id=String(b.id||"");
  const c=pwClaims().find(function(x){return x&&x.id===id;});
  if(!c){return [{json:{ok:false,error:"No Add-a-client request with that id."}}];}
  if(c.status!=="pending"){return [{json:{ok:false,error:"That request was already "+c.status+"."}}];}
  const code=c.code,a=sd.affiliates[code];
  if(!a||a.status!=="active"){return [{json:{ok:false,error:"That partner isn't active, so the client can't join their book."}}];}
  const decision=String(b.decision||"").toLowerCase();
  const reason=String(b.reason||"").replace(/\s+/g," ").trim().slice(0,400);
  const by=String(b.by||"").slice(0,60);
  const NN=String.fromCharCode(10,10);
  if(decision==="decline"){
    if(reason.length<5){return [{json:{ok:false,error:"Say why in a few words; the partner sees it."}}];}
    c.status="declined";c.decided_at=nowISO();c.reason=reason;if(by){c.decided_by=by;}
    pwEvent(code,"claim","Station didn't add "+c.business+" to your book",reason);
    const m=await pwMail.call(this,code,a,"claim","Station didn't add "+c.business+" to your book",
      "Station looked at "+c.business+" and didn't add it to your book."+NN+"Why: "+reason+NN+"Questions? Message Station in Partner World: https://partners.station.solutions"+NN+"Station");
    return [{json:{ok:true,claim:pwClaimView(c),mail:m}}];
  }
  if(decision!=="accept"){return [{json:{ok:false,error:"decision must be accept or decline"}}];}
  // the same rules as cc_accept: never another partner's client
  let tok=null;try{tok=await brokerKey.call(this,HQ);}catch(e){tok=null;}
  if(!tok){return [{json:{ok:false,error:"Couldn't reach the CRM. Nothing was changed -- try again."}}];}
  let cid="",found=null;
  try{
    let d=await hget.call(this,GHL+"/contacts/search/duplicate?locationId="+encodeURIComponent(HQ)+"&email="+encodeURIComponent(c.email),tok);
    if(typeof d==="string"){try{d=JSON.parse(d);}catch(e){d={};}}
    if(d&&d.contact&&d.contact.id){found=d.contact;cid=String(d.contact.id);}
  }catch(e){return [{json:{ok:false,error:"Couldn't reach the CRM. Nothing was changed -- try again."}}];}
  if(found){
    let tags=found.tags;
    if(!Array.isArray(tags)){try{const gx=await hget.call(this,GHL+"/contacts/"+encodeURIComponent(cid),tok);tags=((gx&&gx.contact)||{}).tags||[];}catch(e){tags=[];}}
    const t=tags.map(function(x){return String(x).toLowerCase();});
    const other=t.find(function(x){return x.indexOf("aff-")===0&&x!=="aff-"+code;});
    if(other){return [{json:{ok:false,error:"That business is already in another partner's book ("+other.slice(4)+"). Nothing was changed.",contact_id:cid}}];}
  }else{
    let up=null;
    try{up=await stnUpsertSafe(this.helpers,tok,{locationId:HQ,email:c.email,name:(c.name||undefined),companyName:(c.business||undefined),
      phone:(ccDigits10(c.phone)?("+1"+ccDigits10(c.phone)):undefined),source:"Partner World: Add a client"});}
    catch(e){return [{json:{ok:false,error:"Couldn't reach the CRM. Nothing was changed -- try again."}}];}
    cid=String((up&&up.contact&&up.contact.id)||"");
    if(!cid){return [{json:{ok:false,error:"The CRM didn't return a contact. Nothing was changed -- try again."}}];}
  }
  const tags=["aff-"+code,"client"];
  const bun=String(b.bundle||"").trim().toLowerCase();
  if(bun){if(CLAIM_BUNDLES.indexOf(bun)<0){return [{json:{ok:false,error:"bundle must be answer, getfound, followup, core, pro or custom"}}];}tags.push("station-"+bun);}
  if(Array.isArray(b.products)&&b.products.length){
    const cat=await catalogue.call(this);
    for(const x of b.products.slice(0,MAX_CLIENT_SKUS)){
      const k=String(((x&&x.sku)||x)||"").trim().toLowerCase();if(!k){continue;}
      const P=cat&&cat.products?cat.products[k]:null;
      if(!P){return [{json:{ok:false,error:"There is no product called \""+k+"\" in the catalogue. Nothing was changed."}}];}
      const pn=String(((x&&x.plan)||"base")||"base").trim().toLowerCase();
      if(pn!=="base"&&!(P.plans&&P.plans[pn])){return [{json:{ok:false,error:P.name+" has no \""+pn+"\" tier. Nothing was changed."}}];}
      tags.push(skuTag(k,pn));
    }
  }
  if(!(await addTags.call(this,cid,tags,tok))){return [{json:{ok:false,error:"The CRM didn't take the tags. Try again.",contact_id:cid}}];}
  // ---- one pass of writes
  a.book_since=Object.assign({},(a.book_since&&typeof a.book_since==="object")?a.book_since:{});
  if(!a.book_since[c.email]){a.book_since[c.email]=nowISO();}
  c.status="accepted";c.decided_at=nowISO();c.contact_id=cid;if(reason){c.reason=reason;}if(by){c.decided_by=by;}
  pwEvent(code,"claim","Station added "+c.business+" to your book","You earn 40% of what they pay Station, from their first payment that clears.");
  const m=await pwMail.call(this,code,a,"claim","Station added "+c.business+" to your book",
    "Station accepted "+c.business+" into your book."+NN+"You earn 40% of what they pay Station, once each payment clears; it shows in Partner World under Money. They're on Clients there too, where you can talk with them."+(reason?(NN+"Station's note: "+reason):"")+NN+"Partner World: https://partners.station.solutions"+NN+"Station");
  try{await tg.call(this,"Add a client ACCEPTED: "+c.business+" <"+c.email+"> -> "+String(a.name||code)+" ("+code+")");}catch(e){}
  return [{json:{ok:true,claim:pwClaimView(c),contact_id:cid,mail:m}}];
}
if(action==="st_slots"||action==="st_book"){
  // agreement 4.2: support is Station's. A partner books Station for themselves (for:"me") or for a client in their book.
  const g=pwGate(b);if(g.err){return [{json:{ok:false,error:g.err}}];}
  const code=g.code,a=g.a;const now=Date.now();
  const forWho=String(b.for||"me")==="client"?"client":"me";
  const cal=stCal(forWho);
  if(!cal){return [{json:{ok:false,error:"Station's calendar isn't set up yet. Message Station instead."}}];}
  const tz=ccTzOf(a);
  let tok=null;try{tok=await brokerKey.call(this,HQ);}catch(e){tok=null;}
  if(!tok){return [{json:{ok:false,error:"Couldn't reach Station's calendar just now. Try again in a minute."}}];}
  const up=stUpcoming(code,now).map(function(x){return {start:x.start,who:x.who,label:x.label||"",topic:x.topic||""};});
  if(action==="st_slots"){
    let res=null;
    try{res=await hget.call(this,GHL+"/calendars/"+encodeURIComponent(cal)+"/free-slots?startDate="+now+"&endDate="+(now+14*CC_DAY)+"&timezone="+encodeURIComponent(tz),tok);}
    catch(e){return [{json:{ok:false,error:"Couldn't read Station's calendar just now. Try again in a minute."}}];}
    const days=[];
    Object.keys(res||{}).forEach(function(k){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(k)){return;}
      const sl=((res[k]||{}).slots||[]).filter(function(s){return (Date.parse(s)||0)>now+2*3600000;}).slice(0,24);
      if(sl.length){days.push({date:k,slots:sl});}
    });
    days.sort(function(x,y){return x.date<y.date?-1:1;});
    return [{json:{ok:true,for:forWho,tz:tz,days:days.slice(0,10),upcoming:up,max:ST_UPCOMING_MAX}}];
  }
  const start=String(b.start||"").trim();const sm=Date.parse(start);
  if(!start||!isFinite(sm)||!CC_NEXT_DT.test(start)){return [{json:{ok:false,error:"Pick a time."}}];}
  if(sm<now+2*3600000){return [{json:{ok:false,error:"Pick a time at least 2 hours from now."}}];}
  if(sm>now+30*CC_DAY){return [{json:{ok:false,error:"Pick a time in the next 30 days."}}];}
  const topic=String(b.topic||"").replace(/\s+/g," ").trim().slice(0,300);
  if(topic.length<5){return [{json:{ok:false,error:"Say in a few words what the call is about."}}];}
  if(up.length>=ST_UPCOMING_MAX){return [{json:{ok:false,error:"You have "+ST_UPCOMING_MAX+" calls with Station coming up. Message Station if you need another."}}];}
  const subj=await bookingSubject.call(this,code,a,forWho==="client"?{subject:"client",contactId:b.contactId}:{subject:"self"},tok);
  if(subj.err){return [{json:{ok:false,error:(subj.err==="not your client"?"That client isn't in your book.":"Couldn't book that just now: "+subj.err+".")}}];}
  const title=(forWho==="client"?("Support: "+String(subj.label||"client")+" (via "+String(a.name||code)+", partner)"):("Partner call: "+String(a.name||code))).slice(0,120);
  let out=null;
  try{out=await hpost.call(this,GHL+"/calendars/events/appointments",tok,{calendarId:cal,locationId:HQ,contactId:subj.id,startTime:start,
    title:title,appointmentStatus:"confirmed",ignoreFreeSlotValidation:false});}
  catch(e){return [{json:{ok:false,error:"That time couldn't be booked. It may have just been taken: pick another."}}];}
  const appt=String((out&&(out.id||(out.appointment&&out.appointment.id)))||"");
  if(!appt){return [{json:{ok:false,error:"That time couldn't be booked. Pick another."}}];}
  // ---- booked: one pass of writes
  const at=nowISO();
  sd.cal_bookings=sd.cal_bookings||[];
  sd.cal_bookings.push({id:"cb-"+(nonce().slice(0,10)||String(now)),code:code,start:start.slice(0,40),calendarId:cal,contactId:subj.id,
    who:(forWho==="client"?"station-client":"station-self"),label:String(forWho==="client"?(subj.label||"your client"):"Station").slice(0,120),
    appt:appt,booked:at,topic:topic.slice(0,200)});
  const mineB=sd.cal_bookings.filter(function(x){return x.code===code;});
  if(mineB.length>200){const drop=mineB[0].id;sd.cal_bookings=sd.cal_bookings.filter(function(x){return x.id!==drop;});}
  const whenTxt=fmtWhen(start);const joinAt=joinLinkOf(out);const N1=String.fromCharCode(10),NN=String.fromCharCode(10,10);
  try{await snotify.call(this,code,"**"+(forWho==="client"?"Support call for a partner's client":"A partner booked a call with Station")+"** -- "+
    (forWho==="client"?(String(subj.label||"client")+" via "):"")+String(a.name||code)+", "+whenTxt+" ("+tz+")"+N1+"> "+topic);}catch(e){}
  const subjLine=(forWho==="client"?("Booked: Station support for "+String(subj.label||"your client")):"Your call with Station")+" -- "+whenTxt;
  const m=await pwMail.call(this,code,a,"booking",subjLine,
    (forWho==="client"?("Station will call "+String(subj.label||"your client")+" for support."):"Your call with Station is booked.")+NN+
    "When: "+whenTxt+" (your time)"+(joinAt?(N1+"Join: "+joinAt):"")+N1+"About: "+topic+NN+
    "Add it to your calendar:"+N1+"Google: https://msgsndr.com/google/calendar/add-event/"+appt+N1+
    "Outlook or Apple: https://msgsndr.com/google/calendar/get-ics/"+appt+NN+"Station");
  return [{json:{ok:true,booked:{start:start,appt:appt,for:forWho,label:(forWho==="client"?String(subj.label||""):"Station"),topic:topic},
    when:whenTxt,mail:m}}];
}
if(action==="pw_event_add"){
  // admin: Circle posts a line to a partner's What's new (a founder's reply, a payout made by hand, a note)
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const code=String(b.code||"").toLowerCase().replace(/[^a-z0-9-]/g,"");
  if(!code||!sd.affiliates[code]){return [{json:{ok:false,error:"unknown partner code"}}];}
  const kind=String(b.kind||"note").toLowerCase();
  if(["reply","payout","client","note"].indexOf(kind)<0){return [{json:{ok:false,error:"kind must be reply, payout, client or note"}}];}
  const title=String(b.title||"").replace(/\s+/g," ").trim();
  if(!title){return [{json:{ok:false,error:"title required"}}];}
  const ev=pwEvent(code,kind,title.slice(0,160),String(b.text||"").replace(/\s+/g," ").trim().slice(0,400),{by:"station"});
  return [{json:{ok:true,event:ev}}];
}
if(action==="st_cal_set"){
  // admin: which HQ calendar partners book Station on (default "Station Support Call" for both)
  if(b.secret!==BSECRET){return [{json:{ok:false,error:"unauthorized"}}];}
  const cur=(sd.st_cal&&typeof sd.st_cal==="object")?sd.st_cal:{};
  const nx={me:cur.me||"",client:cur.client||""};
  for(const k of ["me","client"]){
    if(b[k]===undefined){continue;}
    const v=String(b[k]||"").trim();
    if(v&&!/^[A-Za-z0-9]{10,40}$/.test(v)){return [{json:{ok:false,error:k+" must be a calendar id"}}];}
    nx[k]=v;
  }
  sd.st_cal=Object.assign(nx,{at:nowISO()});
  return [{json:{ok:true,st_cal:{me:stCal("me"),client:stCal("client")}}}];
}
// ---- /v4.65
'''

CLIENT_ALERT_OLD = '''  await snotify.call(this,who.code,String(b.title||"Client update")+" — "+client);'''
CLIENT_ALERT_NEW = CLIENT_ALERT_OLD + r'''
  // v4.65: Partner World's What's new, and an email to the partner on a purchase or setup (pwMail: ceilinged, ledgered).
  // New Client Alert and Product Setup can both fire for one sale: one event and one email per client per 6 hours.
  try{
    const _t=String(b.title||"Client update");
    const _k=/purchas|bought|new client/i.test(_t)?"purchase":/setup/i.test(_t)?"setup":/change/i.test(_t)?"change":"client";
    const _sk=(sk&&sk.name)?String(sk.name):"";
    const _buy=(_k==="purchase"||_k==="setup");
    const _dup=_buy&&(Array.isArray(sd.pw_events)?sd.pw_events:[]).some(function(e){
      return e&&e.code===who.code&&(e.kind==="purchase"||e.kind==="setup")&&e.client===client.slice(0,120)&&Date.now()-(Date.parse(e.at)||0)<6*3600000;});
    if(!_dup){
      pwEvent(who.code,_k,_buy?(client+" bought "+(_sk||"from Station")):(_t+": "+client),
        _buy?"Station sets it up and handles their support. Your 40% starts once their payment clears.":"",{client:client.slice(0,120)});
      if(_buy){
        const NN=String.fromCharCode(10,10);
        await pwMail.call(this,who.code,sd.affiliates[who.code],"purchase","A client of yours bought "+(_sk||"from Station"),
          client+" just bought "+(_sk||"from Station")+"."+NN+"Station sets it up and handles their support. Your 40% starts once their payment clears, and it shows in Partner World under Money."+NN+
          "Partner World: https://partners.station.solutions"+NN+"Station");
      }
    }
  }catch(e){}'''

LEAD_BOOK_EMAIL_OLD = '''  // bookingSubject: find-or-create the contact (an existing one never gets a name), then POST /contacts/{id}/tags'''
LEAD_BOOK_EMAIL_NEW = r'''  // v4.65: an email the partner typed for a business that has none is kept, so the booking can be confirmed to them
  {const _be=String(b.email||"").trim().toLowerCase().slice(0,160);if(_be&&validEmail(_be)&&!String(l.email||"").trim()){l.email=_be;}}
''' + LEAD_BOOK_EMAIL_OLD

LEAD_BOOK_DONE_OLD = '''  await pbAnnounce.call(this,code,a,l,start,out,appt);
  return [{json:{ok:true,booked:l.booked,when:fmtWhen(start),lead:l}}];'''
LEAD_BOOK_DONE_NEW = '''  await pbAnnounce.call(this,code,a,l,start,out,appt);
  const lbm=await lbConfirm.call(this,code,a,l,start,subj.id,tok);   // v4.65: the business hears from Station (cold lane)
  return [{json:{ok:true,booked:l.booked,when:fmtWhen(start),lead:l,lead_mail:lbm}}];'''

PB_MAIL_OLD = '''    await sendMail.call(this,a.email,(a.name||code),"Booked: "+biz+" -- "+whenTxt,'''
PB_MAIL_NEW = '''    await pwMail.call(this,code,a,"booking","Booked: "+biz+" -- "+whenTxt,   // v4.65: ceilinged + ledgered'''

ME_OLD = '''clicks:clicks,leads:book.leads,clients:book.clients.length,plans:book.plans,'''
ME_NEW = '''clicks:clicks,leads:book.leads,clients:book.clients.length,plans:book.plans,
    ref:pwRef(code),claims_open:pwClaimsOpen(code), // v4.65'''

ATTR_OLD = '''if(sd.attributions.length>5000){sd.attributions=sd.attributions.slice(-4000);}'''
ATTR_NEW = ATTR_OLD + '''
  if(String(b.kind||"visit")==="visit"&&!sd.ref_seen_at){sd.ref_seen_at=new Date().toISOString();} // v4.65: visits are reaching the engine'''

TAX_OLD = '''  const type=String(b.type||"Tax form").slice(0,30);'''
TAX_NEW = '''  // v4.65: the upload says which form it is (Partner World offers both); Finish Upload stores it on a.taxform.type
  const _tt=String(b.type||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const type=_tt==="W9"?"W-9":(_tt==="W8BEN"?"W-8BEN":"");
  if(!type){return [{json:{ok:false,error:"Say which form it is: W-9 (U.S.) or W-8BEN (outside the U.S.)."}}];}'''

CLIENT_ADD_OLD = '''  if(!partnerOnly(a)){return [{json:{ok:false,error:("Adding clients is a Partner tool"'''
CLIENT_ADD_NEW = '''  // v4.65 (agreement 6.2): a client joins a book when STATION accepts it. Partners ask with client_claim (Partner World >
  // Clients > Add a client); this direct write into the partner's own book is closed.
  return [{json:{ok:false,refused:"claim",error:"Station adds clients to your book. In Partner World, open Clients and press Add a client; Station accepts it."}}];
''' + CLIENT_ADD_OLD

ACTION_OLD = '''const action=String(b.action||"").toLowerCase();'''
END_OLD = '''// ---- /v4.44
return [{json:{ok:false,error:"unknown action"}}];'''

EDITS = [
    (NEEDS, NEEDS + "\n// v4.65 (2026-10-07): Partner World's missing pieces -- pw_news, me.ref, client_claim (Station accepts), st_slots/st_book,\n"
                    "//        the lead's booking confirmation from the cold lane, ceilinged partner notices, W-9 / W-8BEN", 1),
    (ACTION_OLD, HELPERS + ACTION_OLD, 1),
    (END_OLD, ACTIONS + END_OLD, 1),
    (CLIENT_ALERT_OLD, CLIENT_ALERT_NEW, 1),
    (LEAD_BOOK_EMAIL_OLD, LEAD_BOOK_EMAIL_NEW, 1),
    (LEAD_BOOK_DONE_OLD, LEAD_BOOK_DONE_NEW, 1),
    (PB_MAIL_OLD, PB_MAIL_NEW, 1),
    (ME_OLD, ME_NEW, 1),
    (ATTR_OLD, ATTR_NEW, 1),
    (TAX_OLD, TAX_NEW, 1),
    (CLIENT_ADD_OLD, CLIENT_ADD_NEW, 1),
]


def patched(code):
    if NEEDS not in code:
        sys.exit("the live engine is not v4.64 (its v4.64 line is missing): refusing")
    for old, new, n in EDITS:
        c = code.count(old)
        if c != n:
            sys.exit("ANCHOR count=%d (expected %d): %r" % (c, n, old[:110]))
        code = code.replace(old, new)
    return code


def parse_check(code):
    fd, chk = tempfile.mkstemp(suffix=".js", prefix="_v465_check_")
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
    d = difflib.unified_diff(before.splitlines(True), after.splitlines(True), "jsCode (live)", "jsCode (v4.65)", n=2)
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
    if "--export" in sys.argv:   # read only: the live jsCode to a file (for --offline + the sandbox test)
        dst = sys.argv[sys.argv.index("--export") + 1]
        live_code = next(n for n in wf["nodes"] if n["name"] == NODE)["parameters"]["jsCode"]
        with open(dst, "w", encoding="utf-8") as f:
            f.write(live_code)
        print("exported", len(live_code), "chars to", dst, "| v4.65 live:", MARK in live_code)
        return
    node = next(n for n in wf["nodes"] if n["name"] == NODE)
    before = node["parameters"]["jsCode"]
    if MARK in before:
        sys.exit("already applied (v4.65 marker is live): refusing")
    bdir = os.path.expanduser(os.path.join("~", ".station", "backups"))
    os.makedirs(bdir, exist_ok=True)
    bak = os.path.join(bdir, "affiliate-engine-pre-v465-%s.json" % time.strftime("%Y%m%d-%H%M%S"))
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
    print("active:", live_wf.get("active"), "| v4.65 live:", MARK in live, "| byte-identical:", live == after)
    print("roll back: re-PUT the node jsCode from", bak)


if __name__ == "__main__":
    main()
