# Demo script: the grandmother and the parent

About 7 minutes. Use two browser windows (or one normal and one private) so you can switch between the two people quickly.

## Before you present

Run these in the Supabase SQL editor, in order (once):

1. `supabase/ai_matching.sql`
2. `supabase/explore.sql` (Explore, plus better match quality)
3. `supabase/demo_stories.sql` (adds the story demo people and two parents' problems). Run it after explore.sql so the demo uses the improved matching.

Accounts used:

| Role | Account | Used as |
|---|---|---|
| Helper | `junaidcmdd@gmail.com` | **The grandmother** |
| Seeker | `junaidpallikkal982@gmail.com` | **The parent** |
| Admin | `pesthanseeh929@gmail.com` | The platform owner |

If the helper account already has a profile, "My profile" shows it. You can overwrite it live in step 1.

## Story to tell

> Leela is a grandmother who spent forty years telling bedtime stories. Her grandchildren live abroad now, so her stories have nobody to hear them. Neha is a parent who wants exactly that for her kids. They would never find each other. RePair does it, and you don't fill in a single form.

## Steps

**1. The helper tells Pip who she is** (helper window, signed in as `junaidcmdd`)
- Dashboard, then "My profile" (or "Create my profile").
- Type or speak: *I am a grandmother who loves telling bedtime stories to children. My grandchildren live far away now, so I have no little ones to tell my stories to.*
- Press "Create my profile". Pip shows the profile card the way seekers will see it.
- Say: "That was one message. No categories, no skills list."

**2. The seeker asks Pip** (seeker window, signed in as `junaidpallikkal982`)
- Dashboard, then "Tell Pip a problem".
- Type: *I want a grandmother to tell bedtime stories to my kids.*
- The matching animation plays, then **swipe cards** appear: the live grandmother plus the demo grandmothers (they show a "Demo" tag).
- Point at "You both mention: grandmother, stories, bedtime, children". Say: "Every match shows why."
- Swipe right, or press the heart, on the real grandmother. A request is sent.

**3. The helper gets notified and accepts** (helper window)
- Dashboard shows "Requests for you" with the parent's message. Press **Accept**.
- Open Messages and say hello. Reply from the seeker window to show live chat.

**4. The problem with no match yet** (seeker window)
- Tell Pip: *My father is 72 and needs someone patient to teach him WhatsApp video calls.*
- Pip says: "I've saved your problem. Nobody fits yet. I'll notify you when someone does."
- Say: "Nobody is lost. The problem waits."

**5. A helper joins, the seeker is notified** (helper window)
- "My profile", then "Change what I wrote". Type: *I help older people learn to use smartphones, WhatsApp and video calls. I am patient and explain things step by step.*
- Pip says how many waiting people were matched.
- Switch to the seeker window: the bell shows a new notification, "Good news: a possible match for ...". Open it and the swipe card is there.

**6. Explore: problems and solvers** (any window, signed in)
- Open **Explore**. At the top choose **Problems** or **Solvers**.
- **Problems:** see every registered problem. Search (try *stories for children*, the word list understands "kids = children"). Use **Best for me** or **Waiting longest**. Tap a "Popular now" topic. Press **Surprise me**.
- Tap a problem. A panel slides in with the full text and a chat box. Use the arrows (or the keyboard arrow keys) to flip through the next problems without closing it.
- Signed in as the **parent** (a seeker): open a problem you can help with, type "I can help with this" and press send. Say: "Even someone who came to ask for help can help others. Helping switches on automatically."
- **Solvers:** tap the grandmother, type "Hi! Are you free this week?" and send. She sees it as a request and can accept.
- Press the bookmark on anything to **save** it, then use **Saved** to see only your saved ones.

**7. Admin** (third window, `pesthanseeh929`)
- Admin overview shows what needs attention (reports, verifications, **problems with no match yet**), then the numbers. Open "Waiting" to show unmatched problems.

## If something goes wrong

- **"Nothing happens after Find my match":** check your internet and try again. The problem is only saved once the screen moves on.
- **No cards after step 2:** make sure step 1 was done first, and that the helper text mentions *stories*.
- **The AI is off:** the demo still works. Matching uses the words in the text and a built-in word list (kids = children, granny = grandmother). With an AI key deployed, Pip also adds related words.
- **Reset the story:** `supabase/demo_remove.sql` removes all demo people. Re-run `demo.sql` and `demo_stories.sql` to bring them back.
