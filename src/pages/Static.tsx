import type { ReactNode } from 'react'
import { ButtonLink } from '../components/ui'

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-5 px-4 py-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {children}
    </article>
  )
}

export function HowItWorks() {
  return (
    <Doc title="How RePair works">
      <h2>1. Describe</h2>
      <p>Write your problem in plain words. Add the skills it needs, where you are, and how urgent it is.</p>
      <h2>2. Match</h2>
      <p>
        RePair compares your needs with people’s listed skills, experience and availability. Each match shows the
        reason. Anything a person has not shared is shown as “not provided”.
      </p>
      <h2>3. Connect</h2>
      <p>Send a request. The other person can accept, decline, or ask a question first. Messages open after acceptance.</p>
      <h2>4. Work together</h2>
      <p>Use milestones, tasks and updates to track progress. When it is solved, you confirm and leave feedback.</p>
      <ButtonLink to="/sign-up">Get started</ButtonLink>
    </Doc>
  )
}

export function About() {
  return (
    <Doc title="About RePair">
      <p>
        RePair connects people who face a problem with people, skills and resources that can solve it. It is built for
        India and works in English.
      </p>
      <p>Simple outside. Intelligent inside. Human at its center.</p>
    </Doc>
  )
}

export function Privacy() {
  return (
    <Doc title="Privacy policy">
      <p>This is a starting draft. Have it reviewed before public launch.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your account email and the profile details you add.</li>
        <li>Problems you post, requests, and messages with people you connect with.</li>
      </ul>
      <h2>Who can see it</h2>
      <ul>
        <li>Problems are private unless you choose otherwise.</li>
        <li>Messages are visible only to the two people in the conversation.</li>
        <li>Public problems never show your name.</li>
      </ul>
      <h2>Your choices</h2>
      <p>You can edit your profile, hide it from search, or ask us to delete your account.</p>
    </Doc>
  )
}

export function Terms() {
  return (
    <Doc title="Terms and conditions">
      <p>This is a starting draft. Have it reviewed before public launch.</p>
      <ul>
        <li>You must be 18 or older.</li>
        <li>Share only information you are allowed to share. Be honest about your skills.</li>
        <li>Be respectful. Spam and abuse can lead to removal.</li>
        <li>Any budget shown is informational. RePair does not process payments or guarantee outcomes.</li>
        <li>RePair does not give medical, legal or financial advice. Experts on the platform act independently.</li>
      </ul>
    </Doc>
  )
}
