# SOLVIA — Component Architecture

Goal: one component per concept, no duplicates, consistent styling. Before creating a component, search this list. New shared components must be added here in the same change.

Layers:
1. **`components/ui/`** — shadcn primitives (generated). Style only via tokens (DESIGN.md). Do not fork behaviour.
2. **`components/`** — shared composed components (domain-agnostic or cross-feature).
3. **`features/*/components/`** — feature-specific; may compose layers 1–2.
4. **Pages** — thin; fetch via hooks, compose components, no business logic.

## 1. Primitives (shadcn/ui)
Button · Input · Textarea · Label · Select · Checkbox · RadioGroup · Switch · Slider · Tabs · Dialog · Sheet · AlertDialog · Popover · DropdownMenu · Tooltip · Toast (Sonner) · Badge · Avatar · Skeleton · Progress · Separator · ScrollArea · Command (search) · Form (RHF).

## 2. Shared Components

| Component | Props (key) | Notes |
|---|---|---|
| `Logo` | `variant: 'full'|'mark'` | SVG, theme-aware |
| `ThemeToggle` | — | system/light/dark |
| `PageHeader` | `title, description?, actions?` | consistent page top |
| `EmptyState` | `icon, title, description?, action?` | one action only |
| `ErrorState` | `error, onRetry?` | maps error codes → friendly copy |
| `LoadingState` / `ListSkeleton` | `rows` | |
| `StatusChip` | `kind: 'case'|'connection'|'task'|…, status` | single source of status → color+icon+label mapping |
| `UserAvatar` | `profile, size` | initials fallback |
| `SkillChip` / `SkillList` | `skills, max=3` | "+N" overflow with popover |
| `VerificationBadge` | `level` | icon + label, never decorative |
| `AvailabilityIndicator` | `status` | dot + text |
| `ConfirmDialog` | `title, description, confirmLabel, destructive, onConfirm` | all destructive actions |
| `FormField` | wraps label/help/error | a11y wiring |
| `FileUploader` | `bucket, path, accept, maxSize, onUploaded` | validates type/size, progress |
| `FileList` / `FileItem` | attachments | signed URL on click |
| `RelativeTime` | `date` | `<time>` with title |
| `Pagination` / `InfiniteList` | | |
| `SearchInput` | debounce | |
| `FilterBar` | schema-driven | category, urgency, location |
| `ReportDialog` | `targetType, targetId` | used on any reportable item |
| `BlockButton` | `userId` | with confirm |
| `RequireAuth/RequireAdmin` | route guards | |
| `AppShell`, `PublicShell`, `AdminShell` | layouts | nav config-driven |
| `NavRail`, `BottomTabs`, `UserMenu` | | share one nav config |
| `NotificationBell` | | unread count (Realtime) |
| `Toaster` | | |
| `ReducedMotionProvider` + `useReducedMotion` | | respects OS + user setting |

## 3. Feature Components

### auth
`AuthForm` (sign in/up modes) · `OAuthButtons` · `PasswordResetForm` · `OnboardingWizard` (+ `IntentStep`, `BasicsStep`, `SkillsStep`)

### profile
`ProfileHeader` · `ProfileEditSheet` · `SkillEditor` (autocomplete, proficiency, evidence) · `AvailabilityEditor` · `PrivacySettings` · `ContributionHistory` · `VerificationRequestDialog`

### cases
`ProblemComposer` (variants `hero` | `full`) · `ComposerDetails` (urgency/location/budget/help type) · `VoiceInputButton` · `InterpretationEditor` (editable fields + confirm) · `ClarifyingQuestions` · `CaseCard` · `CaseList` · `CaseHeader` · `CaseTimeline` · `CaseVisibilitySelect` · `ExploreFeed`

### matching
`MatchingScene` (+ `useMatchingSceneState`) · `SolverCard` · `ResourceCard` · `GroupCard` · `MatchList` · `MatchExplanation` (summary + breakdown, shows "not provided") · `MatchFilters` · `OpportunityCard` (solver-side) · `NoMatchesState` (suggest broadening, public post, resources)

### connections
`ConnectDialog` (message + confirm) · `ConnectionStatusChip` · `ConnectionActions` (contextual per state & viewer) · `ConnectionList` · `ClarificationThread` · `RequestLifecycleAnimation` (wraps MatchingScene states)

### messaging
`ConversationList` · `ConversationView` · `MessageBubble` · `MessageComposer` (attachments) · `UnreadBadge` · `SystemMessage`

### collaboration
`WorkspaceTabs` · `ProgressBar` (real) · `TaskBoard` / `TaskItem` / `TaskDialog` · `MilestoneList` / `MilestoneDialog` · `ProgressUpdateFeed` · `ParticipantList` · `ResolutionPanel` (propose/confirm/reopen) · `FeedbackDialog`

### resources
`ResourceForm` (sheet) · `ResourceCard` · `ResourceList` · `AvailabilityToggle`

### trust
`ReportDialog` · `BlockList` · `PrivacyControls`

### notifications
`NotificationList` · `NotificationItem`

### admin
`AdminTable` (sort/filter/paginate) · `StatCard` (real aggregates only) · `ModerationQueue` · `ReportDetail` · `ActionDialog` (reason required) · `VerificationReview` · `DisputePanel` · `CategoryEditor` · `MatchingConfigEditor` · `SettingsForm` · `AuditLogTable`

### public
`HomeHero` · `HowItWorks` · `ConnectionsPreview` (labelled illustrative) · `CategoryGrid` · `AudienceBlocks` · `TrustSection` · `FinalCTA` · `SiteHeader` · `SiteFooter`

## 4. Hooks (non-exhaustive)
`useAuth` · `useProfile` · `useCase(id)` · `useCases` · `useMatches(caseId)` · `useMatchingRun(caseId)` (Realtime) · `useConnections` · `useConversation(id)` (Realtime) · `useNotifications` · `useSpeechRecognition` · `useReducedMotion` · `useDebounce` · `useSignedUrl` · `useIsAdmin`.

## 5. Component Contracts
- Every data component accepts `loading`/`error` handling via the shared states (no ad-hoc spinners).
- Every list has `EmptyState`.
- Props are typed from generated DB types or feature `domain/` types; no `any`.
- Styling: Tailwind utilities + tokens; variants via `cva`; no inline hex colors.
- Accessibility: each interactive component documents keyboard behaviour in its file header and has a Testing Library a11y test.
- Components don't call Supabase directly; they use feature hooks.
- Animations only through shared motion variants (`lib/motion.ts`) with reduced-motion handling.

## 6. Naming & Files
`PascalCase.tsx`, one exported component per file, co-located `*.test.tsx`, barrel `index.ts` per feature exporting the public surface only.
