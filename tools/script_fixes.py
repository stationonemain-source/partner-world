"""Partner World's corrections to the call scripts that come from the live partner guide (station.solutions/partners/guide.md).

Why this file exists (09-29 persona review): the guide's per-product scripts are British English, and several closes promise
what the guide's own rules forbid ("I will have it answering today", "Let me switch it on", "Send me the list", "it has paid
for itself several times"). A partner reading them aloud to a Texas owner would break the rules on the first call.

Rules every line below follows:
- US English, with contractions, the way people talk on the phone.
- The partner never sets anything up, never collects a customer list, never promises a go-live day or a result.
- Every close ends by sending the product page (where the price and the trial live) and asking for an email.
- Only claim a free trial where the live guide does (updated 10-04): every single product, and the three collections (Answer,
  Get Found, Follow Up), start with a 14-day free trial. Core, Pro and Max have NO trial and carry a 30-day money-back guarantee on
  the first paid month. The custom website has no trial.

These are applied on top of the guide by build_data.py. If Circle adopts them, port them into the guide and delete this file.
"""

TRIAL = 'It starts with a 14-day free trial and there’s no contract.'
EMAIL = 'What’s the best email?'

def close(what='see the price and how it works', trial=True):
    return 'Want me to send you the page so you can %s? %s%s' % (what, (TRIAL + ' ') if trial else '', EMAIL)

CALLS = {
    'website': {
        'opener': 'Is your website bringing in the kind of customers you want, or is it something you’ve been meaning to fix?',
        'discovery': 'If you could change one thing about how your business looks online, what would it be?',
        'pitch': 'Station builds custom websites from scratch around your brand, not from a template. You answer about five minutes of questions, and Station builds a free demo of your own site, usually within 2 to 3 business days. It’s priced to the project, and nothing’s charged unless you like it and say yes.',
        'objection': '\u201cWhat does it cost?\u201d \u2014 It depends on the project, so there\u2019s no set price I can quote. That\u2019s why Station builds a free demo of your own site first, and nothing\u2019s charged unless you say yes.',
        'close': 'Want me to send you the link to the questions? It takes about five minutes, and the demo is free. ' + EMAIL},
    'greet': {
        'opener': 'When someone visits your website late at night with a question, what happens?',
        'discovery': 'How many of those people do you think just leave and try someone else?',
        'pitch': 'Greet is a chat assistant on your website. It answers visitors from your own business facts, day or night, and passes you their name, number and what they need. It’s $79 a month.',
        'objection': '“People hate chatbots.” — They hate ones that can’t help. Greet answers from your own prices, service areas and hours, and hands real customers straight to you. Right now, a late-night visitor gets no answer at all.',
        'close': close()},
    'slate': {
        'opener': 'How do customers book with you right now? Do they call, or is there a lot of back-and-forth?',
        'discovery': 'How often does someone just not show up?',
        'pitch': 'Slate lets customers pick a time from your real schedule, then sends reminders so they show up. It’s $59 a month.',
        'objection': '“I like to talk to people first.” — You still can. It can book a short intro call first. You keep control; you just skip the texts back and forth to agree on a time.',
        'close': close()},
    'lineback': {
        'opener': 'About how many calls do you miss in a normal week, when you’re on a job or driving?',
        'discovery': 'When you miss one, do those callers usually wait for you, or try someone else?',
        'pitch': 'A lot of callers try the next business on the list within a couple of minutes. Lineback texts them right after you miss the call, so the conversation stays with you and you can reply when you’re free. It’s $197 a month.',
        'objection': '“I call them back at the end of the day.” — By then a lot of them have booked someone else. The text keeps them talking to you until you’re free.',
        'close': close()},
    'frontdesk': {
        'opener': 'Who answers the phone when you’re busy with a customer?',
        'discovery': 'What happens to calls that come in after hours, say at 8 at night?',
        'pitch': 'Frontdesk is an AI receptionist. It answers every call, day or night, books jobs into your calendar, and always offers to transfer the caller to a person. It’s $397 a month, a lot less than a part-time receptionist.',
        'objection': '“Customers will know it’s not a person.” — Some will notice. Compare that with the alternative, which is voicemail. It’s set up with your prices, your services and what it’s not allowed to promise.',
        'close': close()},
    'pursuit': {
        'opener': 'When someone asks about a job and then doesn’t answer your first reply, what happens next?',
        'discovery': 'How many times do you usually follow up before you let it go?',
        'pitch': 'Most people follow up once. Pursuit keeps following up for you by text and email, over about ten days, and stops the moment they reply or book. It’s $247 a month.',
        'objection': '“I don’t want to annoy people.” — Neither does Station. It stops as soon as they reply, and every message makes it easy to say no thanks. A few polite messages over ten days is just following up.',
        'close': close('see the messages it sends')},
    'repute': {
        'opener': 'How many Google reviews do you have, compared with the competitor you lose the most work to?',
        'discovery': 'How do you ask customers for reviews right now?',
        'pitch': 'Repute asks every customer for a review at the right moment after the job, and helps you reply to the reviews that come in. It’s $197 a month.',
        'objection': '“I don’t like asking.” — That’s exactly why it helps that it isn’t you asking. Happy customers are glad to say yes when they’re asked at the right time.',
        'close': close()},
    'echo': {
        'opener': 'If you search Google for what you do in your town, where does your business show up on the map?',
        'discovery': 'Do you know who shows up above you?',
        'pitch': 'Often the businesses above you just have a more complete Google listing. Echo fills yours in properly, posts to it every week, keeps it accurate and sends you a monthly report. It’s $247 a month, with no setup fee.',
        'objection': '“I already have a Google listing.” — Most businesses do. Echo makes sure it’s complete and stays active, which a lot of listings aren’t. Nobody can honestly promise a ranking, and Station doesn’t.',
        'close': close('see everything that’s included')},
    'dispatch': {
        'opener': 'About how many past customers do you have email addresses for?',
        'discovery': 'When did you last send them anything?',
        'pitch': 'Those are people who already trust you. Dispatch lets you send them good-looking emails whenever you want, for $94 a month. Or for $397 a month, Station writes and sends four emails a month for you, and you approve each one first.',
        'objection': '“I don’t want to spam my customers.” — One useful email a month isn’t spam. These are people who already paid you, and every email has an easy unsubscribe.',
        'close': 'Want me to send you the page so you can see both options? The self-serve plan starts with a 14-day free trial, and there’s no contract. ' + EMAIL},
    'revive': {
        'opener': 'How many customers haven’t you heard from in over a year?',
        'discovery': 'Did they leave for a reason, or did they just drift away?',
        'pitch': 'A lot of them just haven’t thought about you in a while. Revive sends them a six-message campaign over about three weeks, with a reason to come back. It’s $197 a month for up to 5,000 contacts, and you can cancel any time.',
        'objection': '“They’ve probably gone somewhere else.” — Some have. A lot just forgot. A friendly reminder is how you find out which is which.',
        'close': 'Want me to send you the page so you can see how it works? ' + TRIAL + ' Station takes the customer list from you directly, so you never need to send it to me. ' + EMAIL},
    'radar': {
        'opener': 'Are there businesses you’d love to have as customers, like offices, property managers or builders?',
        'discovery': 'How do you find new business customers now?',
        'pitch': 'Radar finds the kind of businesses you want as customers in your area, checks each one’s website and listing, and reaches out to them for you from your Station account. It finds five new prospects a week, for $297 a month.',
        'objection': '“I’m not a salesperson.” — You don’t need to be. Each message points out something specific and true about that business’s own website or listing, so it comes across as helpful, not pushy.',
        'close': close('see a sample report')},
    'dial': {
        'opener': 'Is the number on your truck and your website your personal cell phone?',
        'discovery': 'Do you ever end up answering work calls on your day off?',
        'pitch': 'Dial gives your business its own local number, with texting, that works from your phone. It’s $47 a month.',
        'objection': '“Everyone already has my cell number.” — And that keeps working. But the day you hire help or want a weekend off, a business number makes that possible, and it goes with the business if you ever sell.',
        'close': close()},
    'tap': {
        'opener': 'How do customers pay you right now: invoice, cash, check or card?',
        'discovery': 'How long does it usually take for an invoice to get paid?',
        'pitch': 'Tap lets you take payment on the spot, by tapping a card on your phone or by texting a payment link. The money goes straight to your own bank through Stripe or Square. It’s $47 a month plus the normal card fees.',
        'objection': '“My bank charges less.” — Maybe on the card fee. Tap puts card, tap-to-pay and payment links in one place, with every payment matched to the customer, so there’s less chasing.',
        'close': close()},
    'marquee': {
        'opener': 'When did you last post anything on your business’s social media?',
        'discovery': 'If someone looks you up there before they call, what do they find?',
        'pitch': 'Marquee keeps your social media posting regularly, on Facebook, Instagram, your Google profile and more. It’s $197 a month, and you can still post your own jobs whenever you like. For $597 a month plus ad spend, Station makes the posts and runs your ads for you.',
        'objection': '“Social media doesn’t bring me work.” — Often not directly. But people check it after your reviews, and a page that stopped posting two years ago makes them wonder if you’re still open.',
        'close': 'Want me to send you the page so you can see what\u2019s included? The self-serve plan starts with a 14-day free trial, and there\u2019s no contract. ' + EMAIL},
}
# Collections and plans (live guide 10-04). Collections have a 14-day trial; Core, Pro and Max have none and a 30-day money-back on the first paid month.
CALLS['bundle-answer'] = {
    'opener': 'When you’re busy with a customer and the phone rings, what happens to that caller?',
    'discovery': 'And when someone messages you after hours, how long before they hear back?',
    'pitch': 'Station’s Answer plan texts back anyone you miss and answers people who message your website, and customers can book themselves. It’s $297 a month, with no setup fee and a free Station-built website. Does that sound like the gap you have?',
    'objection': '“I’d rather just answer my own phone.” — You should, whenever you can. This is for the calls you can’t get to. When you get voicemail, do callers usually leave a message, or do they try someone else?',
    'close': 'Want me to send you the page with the price, so it’s in writing? It starts with a 14-day free trial and there’s no contract. What’s the best email?'}
CALLS['bundle-getfound'] = {
    'opener': 'When someone searches for what you do, how do your Google reviews compare with the competitor you lose work to?',
    'discovery': 'Is your Google listing up to date: hours, photos, services?',
    'pitch': 'Station’s Get Found plan keeps your Google listing complete, asks every customer for a review and helps you reply, and gives you tools to post to your social pages yourself. It’s $497 a month, with no setup fee and a free Station-built website. Which is the bigger gap, the listing or the reviews?',
    'objection': '“I’ve tried marketing before and it didn’t work.” — Fair, a lot of people have. Station isn’t running ads for you here, and there’s no contract. It works on the first things a new customer checks, you get a monthly report, and it’s month to month, so you’re never stuck.',
    'close': 'Can I send you the page so you can see what’s included and the price? There’s a 14-day free trial and no contract. What’s the best email?'}
CALLS['bundle-followup'] = {
    'opener': 'When someone asks about a job and you don’t book them right then, how many times do you follow up?',
    'discovery': 'And do you have past customers you haven’t emailed in a year or more?',
    'pitch': 'Station’s Follow Up plan follows up on new leads automatically, sends a win-back campaign to your old customers, and lets you email your list yourself. It’s $427 a month, with no setup fee and a free Station-built website. Which of those would help you first?',
    'objection': '“I don’t want to spam my customers.” — These are people who already paid you, every email has an easy unsubscribe, and texts only go to people who agreed to get them.',
    'close': 'I can send you the page with the price and how it works, and I’ll check back in a few days. It starts with a 14-day free trial. What’s the best email?'}
CALLS['bundle-core'] = {
    'opener': 'If you could stop thinking about your front office, what would you hand off first: calls, follow-up, reviews or booking?',
    'discovery': 'How many of those are costing you work right now?',
    'pitch': 'Station’s Core plan is every product except Radar on one bill: calls, chat, booking, follow-up, reviews and Google set up by Station, plus social and email tools you run yourself, and a free Station-built website. It’s $1,297 a month, with a 30-day money-back guarantee on the first paid month. Is that the kind of whole-office fix you’re after?',
    'objection': '“That’s a lot of money.” — It’s a bigger decision. If one thing is your real problem, a single product or a collection from $297 a month may be the better start. If it’s most of them, bought one by one they would be $1,899 a month, and Core is $1,297.',
    'close': 'Want me to send you the page so you can see everything that’s in it, with the price? What’s the best email?'}
CALLS['bundle-pro'] = {
    'opener': 'Which takes more of your week: the social posts, the email campaigns, or the calls?',
    'discovery': 'How busy do the phone and the inbox get in a normal month?',
    'pitch': 'Station’s Pro plan is every product at its busy tier, and Station writes and runs the social posts and email campaigns for you, with a free Station-built website. It’s $2,197 a month, with a 30-day money-back guarantee on the first paid month. Or would a smaller start suit you better?',
    'objection': '“Can I start smaller?” — Yes. A collection starts at $297 a month with a 14-day free trial, and you can move up later if you want to.',
    'close': 'Can I send you the page so you can compare it with a smaller start? What’s the best email?'}
CALLS['bundle-custom'] = {
    'opener': 'What would it mean to hand the whole front office, marketing included, to someone else?',
    'discovery': 'Is there one problem you’d want fixed first?',
    'pitch': 'Station’s Max plan is every product at its top tier, with social and email done for you, priority support, a quarterly review call, and a custom-designed website. It’s $2,797 a month, with a 30-day money-back guarantee on the first paid month. Is that the level you need, or should we start smaller?',
    'objection': '“What does the custom website cost on top?” — The custom-designed website is included in Max. Station can tell you what’s covered once it’s built, and a custom website bought on its own is quoted by Station.',
    'close': 'Can I send you the page with everything that’s included and the price? What’s the best email?'}

CALL_EDITS = {  # small corrections to the hand-written Ribbon / Quorum scripts in build_data.py
    'quorum': {'discovery': 'Have you had a chance to check your posted agendas and minutes against it? That’s the part almost everyone misses.',
               'objection': '“Our web vendor handles it.” — Worth checking the documents: in Quorum’s national scan, 94% of posted agendas and minutes failed, even on sites that looked fine.'},
    'ribbon': {'pitch': 'Ribbon Leads sends you every restaurant and bar that files to open, the morning it files, weeks before it opens, with the phone number when it can be matched. Florida or New York is $49 a month, and there’s a free Monday list to try first.',
               'objection': '“I already hear about openings.” — Usually on opening day, after they’ve chosen. This is the filing, weeks earlier.'},
}

WHY = {
    'website': ['Built from scratch around their brand, with no template underneath.',
                'Booking and lead forms go straight to their Station inbox.',
                'They see a free demo of their own site in 2 to 3 business days, before paying anything.'],
    'greet': ['Answers late at night and on weekends, when a lot of people browse.',
              'Asks the right questions first, so the owner spends time on real customers.',
              'Every chat becomes a contact with a name and a number, even if they don’t book.'],
    'slate': ['No more back-and-forth: customers pick a time from real availability.',
              'Reminders cut no-shows, and a missed appointment is time they can’t get back.',
              'The calendar fills up while they’re working, not while they’re on the phone.'],
    'lineback': ['A missed call is often a lost job, because the caller tries the next name on the list.',
                 'The text reaches them while they still need the work, and they can reply any time.',
                 'It comes with a business number, so nothing changes about how they work.'],
    'frontdesk': ['Answers every call, day or night, without hiring anyone.',
                  'Books jobs straight into the calendar instead of taking a message.',
                  'Doesn’t take days off or breaks.'],
    'pursuit': ['Many owners follow up once and stop, and Pursuit keeps following up politely.',
                'It runs every time, whether or not the owner remembers.',
                'It stops the moment someone replies, so nobody gets pestered.'],
    'repute': ['Reviews are one of the first things a new customer checks.',
               'The request goes out after every job, not just when the owner remembers.',
               'Reviews get replies, so the profile looks active and cared for.'],
    'echo': ['The Google map results are where a lot of local customers choose who to call.',
             'Many listings are half finished: wrong categories, no photos, no posts.',
             'It’s managed every month, because an active listing looks better to customers.'],
    'dispatch': ['Past customers already trust them, so they’re the easiest people to win work from.',
                 'Self-serve, so they send whenever they want.',
                 'On Managed ($397/mo), Station writes and sends four campaigns a month, and they approve each one first.'],
    'revive': ['These people already bought once, so they know the business.',
               '$197 a month with no lock-in; cancel any time. The first win-back wave goes out in month one, then a fresh wave every quarter.',
               'Email first, and texts only go to people who agreed to get them.'],
    'radar': ['Each message opens with something specific and true about the prospect’s own website or listing.',
              'Five new prospects every week (twenty on Pro), so there’s always someone new to talk to.',
              'Replies land in the same Station inbox as everything else.'],
    'dial': ['Their personal cell stops being the business line.',
             'Customers can text the business, which a lot of people prefer to calling.',
             'Their personal number stays personal.'],
    'tap': ['Getting paid on the spot instead of waiting weeks on an invoice.',
            'Card, tap-to-pay and payment links in one place, with every payment tracked.',
            'Station takes none of their revenue; the money goes straight to their bank.'],
    'marquee': ['Their social pages stop looking abandoned.',
                'Posts keep going out in a busy week, which is exactly when they usually stop.',
                'On Managed ($597/mo plus ad spend), Station makes twelve posts a month and runs the ads.'],
    'bundle-answer': ['It covers the gap when you can’t pick up: a text back, chat on the website, booking and payments.',
                      'Worth $382 a month bought one by one (the business number comes with the text-back); the collection is $297 a month, and a Station-built website comes free.',
                      'A 14-day free trial that starts when it’s live, no contract, no setup fee.'],
    'bundle-getfound': ['Reviews and a complete Google listing are among the first things a new customer sees.',
                        'Worth $641 a month bought one by one; the collection is $497 a month, with a free Station-built website.',
                        'A 14-day free trial that starts when it’s live, no contract, no setup fee.'],
    'bundle-followup': ['Leads go quiet when nobody follows up, and old customers already know the business.',
                        'Worth $538 a month bought one by one; the collection is $427 a month, with a free Station-built website.',
                        'A 14-day free trial that starts when it’s live, no contract, no setup fee.'],
    'bundle-core': ['Every product except Radar at its standard tier, on one bill and one monthly report.',
                    'Worth $1,899 a month bought one by one; Core is $1,297 a month, with a free Station-built website.',
                    'No trial; it’s billed at checkout, with a 30-day money-back guarantee on the first paid month.'],
    'bundle-pro': ['Every product at its busy tier, and Station writes and runs the social posts and the email campaigns.',
                   'Worth $3,072 a month bought one by one; Pro is $2,197 a month, with a free Station-built website.',
                   'No trial; it’s billed at checkout, with a 30-day money-back guarantee on the first paid month.'],
    'bundle-custom': ['Every product at its top tier, with social and email done for the client, priority support and a quarterly review call.',
                      'Worth $3,472 a month bought one by one before the website; Max is $2,797 a month and includes a custom-designed website.',
                      'No trial; it’s billed at checkout, with a 30-day money-back guarantee on the first paid month.'],
}

# Replies from the guide that are wrong on one product's page: {box id: {question: new answer}}
REPLY_BY_BOX = {
    'website': {
        'How much is it?': 'Good question. A custom website is priced to the project, so there’s no set price and I can’t quote one. Station builds a free demo of your own site first, usually within 2 to 3 business days, and nothing’s charged unless you like it and say yes.',
        'Send me more info': 'Happy to. Here’s the link to the questions for a custom website: [link]. They take about five minutes, and Station builds a free demo of your own site, usually within 2 to 3 business days. There’s no set price; Station quotes the project after you’ve seen the demo.',
        'Is this a scam? / Who are you?': 'Fair question. I’m [your name], an independent partner with Station. Station is Station Automations Group LLC, based in Houston, Texas, and you can see its work at station.solutions. I earn a commission if you go ahead. The demo of your site is free, and nothing’s charged unless you say yes. You can email Station directly at main@station.solutions. If you’d rather I didn’t contact you again, just say so.',
        'What’s the contract? / Can I cancel?': 'The website itself is a one-time project, and Station quotes it after you’ve seen the free demo. After it’s built, you can run the site yourself, or Station can host and look after it for a monthly fee it quotes for your business. The domain and the site stay yours.',
        'Can you do it cheaper?': 'I can’t set or change prices; Station quotes each website for the project. The free demo is the best way to see what you’d get before any number comes up.',
    },
}
REPLY_BY_BOX['revive'] = {
    'What’s the contract? / Can I cancel?': 'There’s no long-term contract. Revive is billed $197 a month, and you can cancel any time by emailing main@station.solutions from the account owner’s email. Service stays on until the end of the month you’ve paid for, and time already delivered isn’t refunded.',
}
# "How much is it?" for each product, in words Linda can say aloud
_PRICE = {
    'greet': 'Greet is $79 a month for up to 250 chats, with bigger plans for busier websites.',
    'slate': 'Slate is $59 a month for up to 1,000 reminders, or $97 a month if you\u2019re busier.',
    'lineback': 'Lineback is $197 a month for up to 1,500 texts, or $297 a month if you\u2019re busier.',
    'frontdesk': 'Frontdesk is $397 a month for 750 minutes of calls, with bigger plans for busier businesses.',
    'pursuit': 'Pursuit is $247 a month, or $347 a month if you get a lot of leads.',
    'repute': 'Repute is $197 a month.',
    'echo': 'Echo is $247 a month with no setup fee.',
    'dispatch': 'Dispatch is $94 a month if you send the emails yourself, or $397 a month if Station writes and sends them for you.',
    'revive': 'Revive is $197 a month for up to 5,000 contacts. The first win-back wave goes out in month one, then a fresh wave every quarter.',
    'radar': 'Radar is $297 a month for five new prospects a week, or $497 a month for twenty.',
    'dial': 'Dial is $47 a month for up to 1,000 texts.',
    'tap': 'Tap is $47 a month plus the normal card fees from Stripe or Square. Station takes none of your revenue.',
    'marquee': 'Marquee is $197 a month if you post yourself, or $597 a month plus ad spend if Station does it for you.',
    'bundle-answer': 'The Answer collection is $297 a month, with no setup fee, and it includes a free Station-built website. Bought one by one the products would be $382 a month. Adding the AI receptionist is $297 a month more.',
    'bundle-getfound': 'The Get Found collection is $497 a month, with no setup fee, and it includes a free Station-built website. Bought one by one the products would be $641 a month.',
    'bundle-followup': 'The Follow Up collection is $427 a month, with no setup fee, and it includes a free Station-built website. Bought one by one the products would be $538 a month.',
    'bundle-core': 'Core is $1,297 a month, with no setup fee. It covers every product at its standard tier and includes a free Station-built website. Bought one by one they would be $1,899 a month.',
    'bundle-pro': 'Pro is $2,197 a month, with no setup fee. Every product at its busy tier, with social posts and email campaigns written and run by Station, plus a free Station-built website. Bought one by one they would be $3,072 a month.',
    'bundle-custom': 'Max is $2,797 a month, with no setup fee. Every product at its top tier, with social and email done for you, plus a custom-designed website. Bought one by one they would be $3,472 a month before the website.',
}
for _id, _p in _PRICE.items():
    _bundle = _id.startswith('bundle-')
    _plan = _id in ('bundle-core', 'bundle-pro', 'bundle-custom')
    REPLY_BY_BOX.setdefault(_id, {})['How much is it?'] = 'Good question. ' + _p + (
        ' There’s no free trial on this one, but there’s a 30-day money-back guarantee on the first paid month, and no long-term contract.' if _plan else
        ' It starts with a 14-day free trial, and there’s no contract.' if _bundle else
        ' The self-serve plan starts with a 14-day free trial, and there’s no contract.' if _id in ('dispatch', 'marquee') else
        ' It starts with a 14-day free trial, and there’s no contract.') +         ' Every price is published on station.solutions.'
    if _bundle:
        REPLY_BY_BOX[_id]['Can you do it cheaper?'] = ('I can’t change prices. Station sets them, and they’re the same for everyone. What I can do is make sure you’re on the right thing. '
            'If [product] is more than you need, [smaller option] may do the job. A collection or plan already costs less than buying the same products one by one.')
REPLY_BY_BOX['website']['I need to think about it'] = ('Of course, take your time. Would it help if I sent you the link to the questions for your custom website, so everything\u2019s in one place? '
    'The demo is free, and nothing\u2019s charged unless you say yes. If it\u2019s OK, I\u2019ll check back later this week.')
REPLY_BY_BOX['website']['How long does setup take?'] = ('You answer about five minutes of questions, and Station builds a free demo of your own site, usually within 2 to 3 business days. '
    'If you go ahead, Station agrees the page list with you and gives you the timeline. I can\u2019t give you a launch date myself.')
REPLY_BY_BOX['website']['Do I need to be techy?'] = ('No. Station designs and builds the whole site. You\u2019ll share things like your logo and photos, and say what you like. '
    'After it\u2019s built, Station can host and look after it, or you can run it yourself.')
DONT_FIXES = [('mark the lead Not interested', 'mark the lead Do not call')]

# Phrase-level US-English and accuracy fixes, applied to every partner-facing string that came from the guide.
PHRASES = [
    ('enquiries', 'inquiries'), ('enquiry', 'inquiry'), ('enquires', 'inquires'), ('enquire', 'inquire'),
    ('personal mobile', 'personal cell phone'), ('tyre-kickers', 'people who are just shopping around'),
    ('catalogue', 'lineup'), ('a-la-carte', 'bought one by one'), ('nobody actions', 'nobody acts on'),
    ('Tell Station what the client needs with <b>Message Station</b> and Station sends them the quote.',
     'Email Station at main@station.solutions with what the client needs, and Station sends them the quote.'),
    ('Tell Station what the client needs with Message Station and Station sends them the quote.',
     'Email Station at main@station.solutions with what the client needs, and Station sends them the quote.'),
    (' Station’s Cancellation and Refund Policy also mentions annual prepay plans at 10 times the monthly rate. Ask Station before offering one.', ''),
    (" Station's Cancellation and Refund Policy also mentions annual prepay plans at 10 times the monthly rate. Ask Station before offering one.", ''),
    ("Core and Pro use each product's Standard plan.", 'Core and Pro use each product’s standard (entry-level) plan.'),
    ('Core and Pro use each product’s Standard plan.', 'Core and Pro use each product’s standard (entry-level) plan.'),
    ('so it saves $123</', 'so it saves $123 a month</'),
    ('26 April 2027', 'April 26, 2027'), ('26 April 2028', 'April 26, 2028'),
    ('Oregon, New York, Missouri and Chicago', 'Oregon, New York, Missouri and Illinois, where it covers Chicago only'),
    ('ribbon.srv1748596.hstgr.cloud', 'ribbonleads.com'),
    ('What kind of work do you do, and where?', 'What kind of work do you do, and where?'),
    ('When someone inquires and goes quiet, how many times do you follow up?', 'When someone asks about a job and goes quiet, how many times do you follow up?'),
    ('compared with the firm you lose work to', 'compared with the competitor you lose work to'),
    ('(we write and send four campaigns a month)', '(Station writes and sends four campaigns a month)'),
    ("what we'd need from you", "what Station would need from you"), ("A lot of what we do works", "A lot of what Station does works"),
    ("we can build a free demo", "Station can build a free demo"), ("We file it; you just give us", "Station files it; you just give Station"),
    ("simple tools we set up for you", "simple tools Station sets up for you"),
    ('Their Google listing managed properly so they show up in the local map results', 'Their Google listing filled in properly and kept active every week'),
    ('Only trades and services that want business (B2B) customers.', 'Only trades and services that sell to other businesses, like offices or builders. If that’s not who you’re talking to, don’t sell it.'),
    ('Worth $1,655/mo bought one by one', 'Worth $1,655 a month bought one by one'), ('so it saves $260/mo', 'so it saves $260 a month'),
    ('Worth $3,282/mo bought one by one', 'Worth $3,282 a month bought one by one'), ('so it saves $482/mo', 'so it saves $482 a month'),
    ('Worth $873/mo bought one by one', 'Worth $873 a month bought one by one'),
]

PHRASES.append(('Most single products start with a 14-day free trial', 'Every single product starts with a 14-day free trial'))
