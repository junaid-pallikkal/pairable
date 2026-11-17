/**
 * What Pip knows about RePair, so it can always answer, even when the AI service is not connected.
 * Answers describe real behaviour of this app. They never navigate away; they tell the person what to do.
 */

interface Entry {
  /** any of these phrases in the question selects this answer */
  when: string[]
  answer: string
  /** follow-up questions shown as buttons */
  next?: string[]
}

const ENTRIES: Entry[] = [
  {
    when: ['hello', 'hi pip', 'hey', 'good morning', 'good evening', 'namaste'],
    answer: 'Hi! I’m Pip. Tell me what you need and I’ll list people who can help. Or ask me how RePair works.',
    next: ['How does RePair work?', 'How do I find someone?', 'I can help others. How do I start?'],
  },
  {
    when: ['what is repair', 'what is this', 'about repair', 'what do you do', 'how does repair work', 'how does it work', 'how do you work'],
    answer:
      'RePair connects people who need something with people who can offer it. You tell Pip in your own words, no forms. Pip finds the people whose profile fits, shows why, and you choose. When they accept, you chat.',
    next: ['How do I find someone?', 'How does matching work?', 'Is my information private?'],
  },
  {
    when: ['find someone', 'find a helper', 'find help', 'post a problem', 'post problem', 'tell pip', 'ask pip', 'i have a problem', 'how do i ask', 'submit a problem', 'get help', 'need help'],
    answer:
      'Just tell me what you need, like “I need someone to teach my father video calls”, and I’ll list people who fit right here. You can also open “Ask Pip” in the menu, where the best matches appear as swipe cards and a list you can search.',
    next: ['How does matching work?', 'What if nobody matches?', 'Is my information private?'],
  },
  {
    when: ['i can help', 'become a helper', 'offer help', 'my profile', 'create a profile', 'how do i help', 'helper profile', 'solver', 'volunteer', 'offer my'],
    answer:
      'Open “My profile” and tell Pip what you can offer in one message, for example “I am a grandmother who tells bedtime stories”. Pip makes your profile, matches you with people who are waiting, and tells them. You can also open Explore, pick a problem you can help with, and say hello.',
    next: ['What is Explore?', 'How do requests work?'],
  },
  {
    when: ['matching', 'how are matches', 'match score', 'why was', 'ranked', 'ranking', 'how do you match', 'best match'],
    answer:
      'Pip compares the meaningful words in what you wrote with what each helper wrote. Related words count as one idea, so “kids” and “children” match. A match needs at least two shared ideas. Every card shows the exact words you share, so nothing is hidden.',
    next: ['What if nobody matches?', 'Is my information private?'],
  },
  {
    when: ['private', 'privacy', 'my name', 'hidden', 'who can see', 'my data', 'anonymous', 'safe to share'],
    answer:
      'Your problem can be seen by helpers without your name. Your name appears only after you send or accept a request. Nobody can message you until you accept. You can block or report anyone from a card or chat.',
    next: ['How do I block or report someone?', 'How do requests work?'],
  },
  {
    when: ['request', 'accept', 'decline', 'pending', 'reply', 'how do requests work', 'choose someone', 'select'],
    answer:
      'When you choose a helper (or offer help), they get a request with your message. They can accept, decline, or ask a question first. Until they accept, each side can send up to three short messages. After they accept, you chat freely. You get a notification at each step.',
    next: ['Where do I chat?', 'What if nobody matches?'],
  },
  {
    when: ['chat', 'message', 'talk to', 'contact', 'where do i chat', 'messages'],
    answer:
      'Open “Messages” in the menu to see your conversations. A chat opens after the other person accepts. From Explore you can also tap a person or problem and send a first message from the side panel.',
    next: ['How do requests work?'],
  },
  {
    when: ['explore', 'browse', 'search problems', 'saved', 'surprise', 'all problems', 'all solvers'],
    answer:
      'Explore has two tabs: Problems and Solvers. Search with your own words, sort by newest, best for you or waiting longest, tap a topic, and press Surprise me. Tap anything to open a side panel with a chat box. The bookmark saves things for later.',
    next: ['How do I offer help on a problem?'],
  },
  {
    when: ['offer help on a problem', 'help on a problem', 'help someone on explore'],
    answer:
      'Open Explore, tap a problem you can help with, write a short message and send. Even if you joined only to ask for help, helping switches on for you automatically.',
  },
  {
    when: ['nobody matches', 'no match', 'no one', 'nobody', 'no helper', 'waiting', 'notify', 'notification', 'not found'],
    answer:
      'Your problem is saved and stays visible to helpers (without your name). The moment someone writes a profile that fits, I match it and send you a notification. You can also check Explore, or post again in different words.',
    next: ['How does matching work?'],
  },
  {
    when: ['report', 'block', 'abuse', 'spam', 'unsafe', 'harass', 'fake'],
    answer:
      'Every card and chat has Report and Block. Blocking hides you from each other and stops messages. Reports go to our review team, who can hide content or suspend accounts, and every admin action is logged.',
    next: ['What does verified mean?'],
  },
  {
    when: ['verify', 'verified', 'badge', 'trust', 'id checked'],
    answer:
      'A badge such as “ID checked” is given only by an admin after reviewing a request from Settings. If there is no badge, the person has not been verified. We never invent ratings or reviews.',
  },
  {
    when: ['rate limit', 'too many', 'wait a minute', 'email limit', 'cannot sign up', 'can’t sign up', 'cant sign up', 'not getting email', 'confirmation email'],
    answer:
      'Sign-up emails are limited per hour. If you see “too many requests”, wait a minute and try again, sign in if you already have an account, or choose “Continue as guest” when it is offered.',
    next: ['What is a guest account?'],
  },
  {
    when: ['guest', 'without account', 'no account', 'without signing'],
    answer:
      'A guest account lets you say your problem and see matches without an email. A banner lets you save it with an email later so you never lose your matches. If guest access is switched off for the site, you will be asked to sign up first, and your words are kept.',
  },
  {
    when: ['sign up', 'signup', 'register', 'log in', 'login', 'sign in', 'password', 'forgot', 'account', 'create account'],
    answer:
      'Create an account with your name, email and a password of 8 or more characters. Forgot your password? Use “Forgot password?” on the login page and I’ll email a link. Anyone can browse problems without an account.',
    next: ['What is a guest account?'],
  },
  {
    when: ['free', 'cost', 'price', 'pay', 'payment', 'money', 'charge', 'budget', 'fee'],
    answer:
      'RePair does not process payments, and a budget on a problem is only information. Agree anything between yourselves. We never take money for matching.',
  },
  {
    when: ['voice', 'speak', 'microphone', 'mic', 'say it', 'talk instead'],
    answer:
      'Tap the microphone, speak in English, and your words appear. A wave moves with your voice while it listens. If the mic does nothing, check that your browser allows microphone access for this site.',
  },
  {
    when: ['resource', 'equipment', 'lend', 'borrow', 'tool', 'space'],
    answer:
      'Open “Resources” to offer or ask for things such as equipment, a desk or course notes. Matching resources can also show up on a problem’s page, and you can ask the owner for them.',
  },
  {
    when: ['resolve', 'solved', 'close', 'finish', 'feedback', 'reopen', 'done', 'complete'],
    answer:
      'When the work is done, either side can propose a resolution; the person who asked confirms it. Then both can leave feedback. You can reopen within 7 days. Track progress with milestones and tasks on the problem’s Work tab.',
  },
  {
    when: ['are you ai', 'are you a bot', 'are you real', 'who are you', 'your name', 'robot', 'human'],
    answer:
      'I’m Pip, RePair’s helper bot. I answer from what I know about how RePair works, and I can search real helpers for what you need. When the AI service is connected I can answer even more.',
  },
  {
    when: ['thank', 'thanks', 'great', 'awesome', 'nice', 'cool'],
    answer: 'You’re welcome! Ask me anything else, or tell me what you need.',
  },
]

/** The best matching built-in answer, or null if the question is not about RePair. */
export function answerLocal(question: string): { text: string; next: string[] } | null {
  const q = ' ' + question.toLowerCase().replace(/[^a-z0-9’' ]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  let best: { e: Entry; score: number } | null = null
  for (const e of ENTRIES) {
    let score = 0
    for (const w of e.when) if (q.includes(w.length <= 3 ? ' ' + w + ' ' : w)) score += w.length
    if (score > 0 && (!best || score > best.score)) best = { e, score }
  }
  return best ? { text: best.e.answer, next: best.e.next ?? [] } : null
}

/**
 * Is the person saying what they need (rather than asking about the site)?
 * "I need someone to fix my fan" -> yes. "How do I post a problem?" -> no.
 */
export function looksLikeNeed(question: string): boolean {
  const q = question.trim().toLowerCase()
  if (q.length < 12) return false
  if (/^(how|what|why|when|where|who|is|are|can you tell|do you|does|will|should)\b/.test(q) && !/\b(need|looking for|want)\b.*\b(someone|somebody|person|help|teacher|tutor|grandmother|doctor|electrician|plumber)\b/.test(q)) return false
  return /\b(i need|we need|need a|need an|need some|need help|looking for|i am looking|i'm looking|i want|we want|want a|want an|want someone|find me|find a|find someone|search for|help me|can someone|someone to|somebody to|anyone who|anyone to|who can|require)\b/.test(q)
}
