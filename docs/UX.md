# Workflow and wording rules

## Workflow first

- Before building a feature, think of the easiest workflow for the client: fewest clicks, fewest decisions.
- Pick sensible defaults so the user doesn't fill in everything.
- Every list has a friendly empty state with one clear action.
- Show a loading state while waiting.
- After every action, show a short success or failure toast.
- Ask for confirmation before deleting. Offer undo where it's easy.
- Show errors next to the field with the problem, in plain words.
- Works well on mobile and desktop.

## Create and edit

- About 10 fields or fewer, and it fits comfortably: use a popup modal.
- More than 10 fields, or long or hard to use in a popup: use a separate page.
- Create and edit forms look the same: same layout, fields and buttons in the same places.

## Wording

- Simple, everyday words. No technical terms.
- Never show raw error text. Example: "Couldn't save. Please try again."
- Labels are short, 1–3 words where possible.
- Never add descriptions or subtitles under page or section headers.
- Add a description only when the user truly can't understand without it.
