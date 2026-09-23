# Echooo Dashboard — Directory Structure (Reference for React Native App)

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · TanStack Query v5
**Data flow (web):** `Component → *.client.ts → /api/v0/* → *.server.ts → FastAPI backend`

> **For the React Native app:** the mobile app talks to the FastAPI backend **directly** (it does not go through
> `/api/v0/*`). Reuse from the dashboard: `types/` (API shapes), `services/*.server.ts` (endpoint + payload
> reference), `constants/`, `hooks/queries/` (query patterns), `lib/react-query/query-keys.ts` (key conventions),
> `utils/` (pure helpers). Do **not** port: `components/`, `app/`, `styles/`, `middleware.ts`, `context/ThemeContext`.

---

## Root

```text
echooo-dashboard/
├── .github/workflows/build-checks.yml   # CI: lint + typecheck on PRs
├── docs/                                # Architecture notes, RFCs, runbooks, audits, handoffs
├── infrastructure/docker/Dockerfile     # Production container image
├── scripts/check-file-sizes.mjs         # Guard script that fails on oversized source files
├── public/                              # Static assets (images, icons, fonts)
├── .dockerignore  .gitignore  .prettierrc
├── Makefile  cloudbuild.yaml  deploy.sh # Build / GCP Cloud Build / deploy tooling
├── eslint.config.mjs                    # Lint rules (bans `any`, etc.)
├── next.config.ts                       # Next.js config (headers, rewrites, security)
├── postcss.config.mjs                   # Tailwind v4 PostCSS plugin
├── package.json / package-lock.json     # Dependencies and scripts
└── src/                                 # All application code (below)
```

---

## `src/` — top level

```text
src/
├── app/            # Routes (Next.js App Router) — pages, layouts, and /api proxy routes
├── components/     # React UI, grouped by feature
├── config/         # Static config for dashboard widgets and navigation menus
├── constants/      # Fixed values: roles, statuses, user types, platforms, tiers
├── context/        # React context providers (auth, subscription/websocket, theme, etc.)
├── data/           # Static JSON data (e.g. disposable email domain blocklist)
├── hooks/          # Custom hooks; hooks/queries/ holds all TanStack Query data hooks
├── lib/            # Framework-agnostic infrastructure (API errors, auth, env, query client, logger)
├── middleware.ts   # Edge routing/redirects only — NOT authorization
├── services/       # API layer: one folder per backend feature (client + server + index)
├── store/          # Small client-state stores (campaign tabs, edit guard)
├── styles/         # Global and feature CSS
├── theme/          # Design tokens (--echooo-* CSS variables), user themes, helpers
├── types/          # Hand-written TypeScript types for API requests/responses
└── utils/          # Pure helper functions (formatting, validation, exports, mapping)
```

---

## `src/app/` — Routes

```text
app/
├── (auth)/                     # Unauthenticated auth screens
│   ├── login/                  # Email/password login
│   ├── magic-login/            # Passwordless link login
│   ├── oauth/                  # OAuth callback handling
│   ├── register/               # Account registration
│   ├── reset-password/         # Password reset flow
│   └── verify-email/           # Email verification
│
├── (dashboard)/                # Authenticated app shell; 4 parallel role slots
│   ├── layout.tsx              # Picks which slot to render based on resolved role
│   ├── @platform/              # Echooo internal staff (admin) portal
│   ├── @company/               # Agency / company (brand-side) workspace
│   ├── @influencer/            # Creator portal
│   ├── @client/                # B2B client portal (read-mostly campaign view)
│   ├── (common)/               # Screens shared by all roles
│   └── dashboard/              # Dashboard entry
│
├── (public)/                   # Token/link-based pages, no login required
│   ├── api-docs/  auth/  invitations/  join/
│   ├── campaign-request/       # Public campaign request form
│   ├── campaign-management/    # Shared campaign management view
│   ├── content/  content-thread/  published-results/   # Shared content review
│   ├── creator-portal/         # Creator-facing public portal
│   ├── on-boarded/  ready-to-onboard/  shortlisted/  selected-manually/  # Influencer selection stages
│   ├── order-track/  payment-form/  personal-collaboration/
│   ├── profile-analytics-report/  social-accounts/
│
├── api/                        # Next.js route handlers
│   ├── v0/                     # Browser → dashboard proxy to FastAPI (see list below)
│   ├── v1/  shared-reports/  health/
│
├── campaign-analytics-report/[campaignId]/   # Printable/shareable campaign report
├── profile-analysis/           # Influencer profile analysis page
├── signup/  unauthorized/  dev/theme-preview/
└── layout.tsx  error.tsx  global-error.tsx  loading.tsx  not-found.tsx  publiclandingpage.tsx
```

### Role slots — screens per role (good map for mobile navigation)

```text
@platform/     (staff/admin)
  dashboard, campaigns (list/new/[id]), campaign-requests (+forms), assignments (active/completed/today),
  b2b-clients, b2c-clients, brands, categories, content-types, currencies, contact-sales,
  create-user, agent-health, agent-performance,
  billing (plans/addons/features/gateways/subscriptions/usage),
  database (activity/advanced/backups/maintenance/monitoring/performance/security/tables)

@company/      (agency workspace)
  dashboard, campaigns (list/new/[id]), campaign-requests (+forms), influencers, clients (+[id]),
  brands, creator-analytics, profile-analytics, affiliate, whatsapp

@influencer/   (creator)
  dashboard, campaigns, payments

@client/       (B2B client)
  campaigns (list + [id])

(common)/      (all roles)
  messages, notifications, permissions, roles, reports, whats-coming (upcoming features roadmap),
  settings/ → profile, company, security, notifications, billing, team-members,
              social-connections, email-sending, assistant, browser-extension, help
```

### `app/api/v0/` — proxy route groups (each maps 1:1 to a backend feature)

```text
access-grants admin affiliate agent-assignments agent-dispatch-queue agent-social-connections
assigned-influencers auth billing brands bulk-assignments campaign-form campaign-influencer-deliverables
campaign-influencers campaign-management campaigns categories clients comments companies contact-sales
content content-posts content-types creator-marketplace creator-profile currencies database discover
external-api-endpoints finance influencer-contacts influencers instagram invitations lead-capture-forms
list-assignments locations mail-admin mail-messages message-templates notifications oauth openai orders
outreach-agent-manager outreach-agents outreach-email outreach-manager outreach-template-assignments
payments permissions plans platforms price-negotiations profile-analytics providers public
public-sessions reassignment-reasons roles scheduler-management sender-identities sentiment-analysis
shared-influencer-reports social social-accounts statuses support-requests tags twelvelabs
upcoming-features users whatsapp
```

---

## `src/components/` — UI by feature (web-only; rebuild natively in RN)

```text
components/
├── ui/                   # Shared primitives — the design-system equivalent
│   ├── atoms/            # Avatar, Button, IconButton, Input, SearchInput, Spinner, StatusBadge, ToggleSwitch, Tooltip
│   ├── table/            # ManagedTable, column visibility/resize, row, identity badges
│   ├── toolbar/  charts/  page/
│   └── Modal, SidePanel, SplitPanel, Pagination, Stepper, TabSwitcher, Tag, SkeletonLoader, SafeImage, ...
├── affiliate/            # Affiliate/referral program UI
├── assistant/            # In-app AI assistant drawer
├── auth/                 # Login/register forms
├── billing/              # Plans, subscription, usage, upgrade UI
├── campaign-form/        # Campaign creation form sections
├── campaign-summary/     # Campaign summary side panel
├── campaigns/            # Campaign list/detail/tabs
├── chat/                 # Chat + deep-research panel
├── clients/  company/  brands-related UI
├── common/  modals/  error/  providers/  pages/   # Shared layout, modals, error boundaries
├── create-user/          # Staff user creation
├── dashboard/            # Widget-based dashboard
├── database-management/  # Platform admin DB tooling
├── filter-panel/         # Discover/list filter panels
├── finance/  payments/   # Payouts, settlements, finance tables
├── influencer/           # Influencer profile, cards, panels
├── messaging/  whatsapp/ # Inbox, threads, WhatsApp templates
├── navbar/               # Top bar + sidebar
├── outreach/  outreach-manager/   # Email outreach campaigns and agents
├── people/  team-members/  # Team and people management
├── platform/  platform-config/    # Platform-level configuration screens
├── profile-analysis/  social-accounts/   # Social profile analytics and connected accounts
├── public/               # Components for the public (link) pages
├── settings/             # Settings screens
└── ClientOnly, ProtectedRoute, StatCard, EngagementChart
```

---

## `src/services/` — API layer (**most useful reference for RN**)

Each folder follows the same pattern:

```text
services/{feature}/
  {feature}.client.ts   # Browser side: calls /api/v0/* (web only — not needed in RN)
  {feature}.server.ts   # Server side: calls FastAPI — documents real endpoints, params, payloads
  index.ts              # Public exports
```

Feature groups (~95 folders):

```text
Auth & access     auth, oauth, users, roles, permissions, invitations, client-users, team-members, public-sessions
Campaigns         campaign, campaign-management, campaign-influencers, campaign-influencer-deliverables,
                  assignments, assigned-influencers, list-assignments, bulk-assignments, bulk-reassignments,
                  reassignment-reasons, content, content-posts, content-types, comments, price-negotiation
Influencers       influencers, influencer-contacts, social-accounts, social, profile-analytics, profile-refresh,
                  creator-profile, creator-marketplace, discover, nanoinfluencer, insights-iq, ensembledata, avg-views
Outreach & mail   outreach, outreach-email, outreach-agents, outreach-agent-manager, outreach-manager-campaigns,
                  outreach-template-assignments, message-templates, sender-identities, mail-admin, mail-messages,
                  agent-dispatch-queue, agent-social-connections
Billing & money   billing, payments, orders, finance, currencies
Companies         companies, company-analytics, clients, brands, affiliate, contact-sales, lead-capture-forms
Public/shared     public-campaign-*, public-content*, public-comments, public-price-negotiation, shared-reports
Platform          platform, providers, statuses, categories, tags, locations, reference-data, notifications,
                  scheduler, logs, database-management, external-api-endpoints, storage, support-requests,
                  upcoming-features, sentiment-analysis, ai, api, personal-collaboration
```

---

## `src/hooks/`

```text
hooks/
├── queries/     # ~75 TanStack Query hooks (useCampaigns, usePayouts, useNotifications, ...) — one per resource
├── ai/  billing/          # Feature-scoped hooks
├── use*WebSocket.ts       # Realtime: notifications, payments, team member, client users, outreach progress
├── usePermissions, useRequireAuth, useLogin, useSecureApi   # Auth/permission helpers
├── useDebounce, useBreakpoint, useClickOutside, useToggleSet  # Generic UI utilities
└── useCampaignForm, useMemberUpdates, useReadyToOnboard, ...  # Feature logic
```

## `src/lib/`

```text
lib/
├── react-query/        # query-client.ts (defaults) + query-keys.ts (all keys; tenant-sensitive keys include company id)
├── billing/            # Quota error helpers
├── dashboard/          # Widget registry, data fetchers, permission checker
├── influencer-profile-panel/   # Profile side-panel bridge + constants
├── whatsapp/           # 24h window logic, template insights
├── prompts/            # LLM prompt templates (openai, twelvelabs)
└── api-error.ts, auth-utils.ts, auth-mode.ts, csrf.ts, env(.server).ts, feature-flags.ts,
    logger.ts, server-api.ts, nextjs-api.ts, apiThrottling.ts, quota-error.ts, upload-xhr.ts, ...
```

## `src/context/`

```text
AppProviders (composes all)  · AuthContext (session/user)  · SubscriptionContext (single WebSocket per tab)
QueryProvider (TanStack)     · CampaignContext · MessagingContext · OutreachContext · AssistantContext
PlatformConfigContext · LocationCacheContext · SidebarContext · ThemeContext · UpgradeModalContext
```

## `src/constants/` · `src/types/` · `src/utils/`

```text
constants/   roles, statuses (status_id conventions), user-types, social-platforms, influencer-tiers,
             billing/, campaigns/, outreach variables, table column defs
types/       One file per backend domain (campaign, payments/, billing/, users, roles, notifications,
             outreach-*, whatsapp/messaging, social-accounts, ...) — hand-written, copy-friendly into RN
utils/       Pure helpers: format/formatters (money, dates), validation, permissions, role-utils,
             platform-helpers, influencer-mapper, badge/status colors, exports (PDF/Excel — web only),
             billing/ (subscription helpers), security/piiMaskingUtils, escapeHtml, string-helpers
```

## `src/config/` · `src/store/` · `src/styles/` · `src/theme/` · `src/data/`

```text
config/dashboard/    Dashboard widget definitions per role
config/navigation/   Sidebar/nav menu definitions per role (useful map for RN tab/drawer structure)
store/               campaign-tabs-store, edit-guard-store (small client stores)
styles/              Global + per-feature CSS (web only)
theme/               Design tokens (--echooo-*), user themes — mirror colors/spacing in RN theme file
data/                disposable-email-domains.json
```

---

## Porting cheat-sheet (Web → React Native)

| Dashboard piece | In the RN app |
|---|---|
| `types/*` | Copy as-is (pure TS) |
| `constants/*`, `utils/*` (pure) | Copy as-is; skip PDF/Excel/DOM utils |
| `services/*.server.ts` | Use as endpoint/payload reference; write an axios client calling FastAPI directly |
| `hooks/queries/*` + `lib/react-query/query-keys.ts` | Reuse the patterns; TanStack Query v5 works in RN |
| `context/AuthContext`, `SubscriptionContext` | Re-implement (secure token storage, one WebSocket owner) |
| `config/navigation/*` | Blueprint for tab/drawer navigation per role |
| `components/*`, `app/*`, `styles/*` | Rebuild natively (no DOM/Tailwind/Next routing) |
| `middleware.ts`, `app/api/v0/*` | Not needed — server-side authorization stays in the backend |
