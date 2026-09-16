# Frontend SOLID refactoring report

Date: 2026-09-13
Scope: main Angular screens and directly associated frontend code
Baseline: commit `3a68d836f441300d79372bec44de4f6dcec51058`, including the uncommitted working tree inspected on this date
Status: assessment only; no application code was changed

## Executive summary

The frontend has a sound modern Angular foundation: Angular 22, standalone components, signals, strict TypeScript/template checking, lazy-loaded routes, feature-local stores in some areas, shared list controls, design tokens, and production SSR. The production build passes.

It does not yet meet the requested strict SOLID target. The main issue is not Angular itself or the use of `inject()`: it is the concentration of unrelated change reasons in route components and broad data services. The most critical example is `ReportsPage`, whose class spans 1,036 lines and coordinates list, creation, editing, source selection, preview, autosave, publication, history, export polling, download, navigation, localization, and error handling. `ExecutionsPage`, `DashboardPage`, `ScrapBasePage`, `SettingsPage`, and `ScrapReviewDrawer` show the same pattern at different scales.

Recommended order:

1. Restore reliable quality gates and record characterization tests.
2. Use Reports as the first vertical refactoring pilot.
3. Replace broad positional arguments with typed commands/queries; use a Builder only for genuinely complex request construction.
4. Split `GovernanceService` by capability and expose small feature ports.
5. Remove the obsolete datepicker implementation from Executions and consolidate shared formatting, locale, pagination preference, and browser APIs.
6. Apply the same feature architecture incrementally to Executions, Scrap Base, Settings, Dashboard/Kiosk, Action Plans, and Alerts.
7. Enforce boundaries, English code conventions, formatting, and focused size/complexity limits in CI.

### Priority and health

- Actionable findings: **16** (`P0: 0`, `P1: 5`, `P2: 9`, `P3: 2`).
- SOLID conformance: **partial**. SRP and ISP are the main failures; DIP is applied mechanically through Angular DI but not consistently at architectural boundaries.
- Production build: **passes**.
- Unit tests: **fails** with 5 failures; 119 of 124 tests pass.
- Formatting gate: **fails** in 11 files.
- Refactoring risk: **high in Reports**, **medium-high in Executions, Scrap Base, Settings, Dashboard/Kiosk**, and **medium in Action Plans and Alerts**.

## Method and evidence

The assessment covered every route declared in `frontend/src/app/app.routes.ts`, their route components, feature stores/services/models, shared list/filter components, theme files, and the main test/build configuration.

The repository knowledge graph was considered for navigation, but its report was generated from commit `f732ad6b`, while the inspected tree is at `3a68d83` with active frontend changes. Direct inspection of current source is therefore authoritative for this report.

Commands executed:

```text
npm run build                 PASS
npm test -- --watch=false    FAIL: 5 failed, 119 passed
npm run format:check         FAIL: 11 files
Impeccable detector           DEGRADED: parser packages unavailable; regex fallback used
```

The degraded detector result is not treated as a clean accessibility or contrast result. Dynamic Angular image bindings reported as "broken image" are false positives because the inspected elements have bound URLs and alt text.

## Main-screen inventory

The table counts physical source lines, including imports and copy declarations. Class-only line counts are called out where useful.

| Screen | TS / HTML / CSS lines | Main responsibilities currently combined | Target decomposition |
| --- | ---: | --- | --- |
| Reports | 1,326 / 1,377 / 1,378 | List, create flow, editor, source drawers, analytics, autosave, preview, versions, publish, export polling/download | `ReportsRoute`, `ReportList`, `ReportWorkspace`, `ReportSources`, `ReportPreview`, `ReportVersions`, `ReportEditorStore`, `ReportExportCoordinator`, capability-specific API clients |
| Executions | 931 / 455 / 1,072 | List/filter, obsolete datepicker, polling, detail drawer, retry, manual upload, storage, formatting | `ExecutionsRoute`, `ExecutionsListStore`, `ExecutionDetail`, `ManualExecutionUpload`, shared date range, presenters/pipes |
| Dashboard | 751 / 740 / 583 plus a 584-line store | Filter state, view derivations, labels, chart mapping, API access, KPI calculation | Thin route component, `DashboardStore`, `DashboardDataPort`, pure query mapper, KPI selectors, chart presenters |
| Dashboard Kiosk | 213 / 611 / 1,039 plus a 627-line store | Kiosk controls/timers plus a second large dashboard data orchestration path | Reuse the dashboard read model through a small port; isolate slideshow/timer state from data loading |
| Scrap Base | 693 / 376 / 363 | List/filter, selection, route synchronization, templates, review queue, bulk actions | List store, selection model, route coordinator, template facade, review workflow components |
| Scrap Review Drawer | 700 / 363 / 456 | Load/save/finalize, queue navigation, attachments, templates, preview, authorization, conflict handling | `ScrapReviewStore`, queue navigator, attachment coordinator, template action, presentational drawer |
| Settings | 612 / 908 / 1,187 | Preferences, classification rules, defect types, targets, chart calculation, feedback timers | One shell plus independent tab components/stores: preferences, classifications, defect types, targets |
| Action Plans | 512 / 504 / 660 | List, editor, report/version linking, Kanban, tasks, history, participants, persistence | List route, plan editor, board store, task editor, history panel, typed action commands |
| Alerts | 365 / 426 / 462 | Alert inbox, rules CRUD, participants/tiers, notification email history | Alert inbox, rule editor/store, notification history, independent data clients |
| Profile | 345 / 233 / 396 | Profile form and image lifecycle | Keep as one route; optionally extract image upload/preview lifecycle if it grows |

Positive evidence to preserve:

- Routes are lazy-loaded in `app.routes.ts`.
- Strict TypeScript, strict templates, and `noImplicitReturns` are enabled.
- Standalone components and `inject()` follow Angular 22 conventions.
- Shared list components already cover panel, feedback, pagination, status badge, filters, skeleton, and delayed progress.
- Dashboard defers below-the-fold charts with `@defer (on viewport)`.
- Most CSS uses application/theme variables, and responsive breakpoints exist on the principal screens.
- The bulk-review dialog explicitly moves focus to its title; that implementation is a useful accessibility reference for the other custom dialogs.

## SOLID assessment

### S — Single Responsibility Principle: not met on the main routes

A responsibility is defined here as a reason to change, not merely a method count. The route components have multiple independent reasons to change.

- `ReportsPage` (`reports-page.ts:310-1325`) has at least eight: report discovery, creation, draft editing, scope/section editing, source selection, preview, version publication, and export lifecycle. Its 77 methods, 75 properties, and 28 subscriptions are symptoms of this coupling.
- `ExecutionsPage` (`executions-page.ts:81-930`) combines list querying, polling, detail presentation, retry, file validation/upload, local preference persistence, datepicker implementation, and formatters.
- `SettingsPage` (`settings-page.ts:27-611`) contains four distinct settings products and pure target/sparkline calculations.
- `ScrapReviewDrawer` (`scrap-review-drawer.ts:51-699`) owns both UI state and a multi-step review/upload/finalization workflow.
- `DashboardStore` combines HTTP access, API parameter serialization, API response mapping, filter options, localized labels, KPI rules, comparison rules, and mutable UI state.

Target rule: a route component composes feature components and translates user events into store/use-case calls. It does not serialize HTTP payloads, implement storage policies, run polling workflows, format domain values, or own multiple independent editors.

### O — Open/Closed Principle: partially met

Typed unions for status/format values are a good foundation. Extensibility is weakened by stringly typed commands and scattered switch/map logic.

- `GovernanceService.command(task, command: string, extra: object)` accepts invalid command/payload combinations at compile time.
- `ReportsService.mutateSources(reportId, kind, operation, expectedVersion, ids)` exposes two independent string switches, allowing nonsensical combinations to flow until runtime.
- Export formats/defaults are coordinated between the page and service, so adding a format changes multiple places.
- Status labels and tones are repeated inside pages rather than exposed through exhaustive, pure presenters.

Target rule: use discriminated command unions and exhaustive presenters. Adding a supported command or format should normally add one implementation/registration and its tests, not conditional branches across route components.

### L — Liskov Substitution Principle: no current inheritance defect; protect future ports

The frontend uses composition and has little application inheritance, so no material LSP violation was found. Do not introduce base page classes to remove repetition; that would couple unrelated screens and make substitutability harder.

For new ports such as `ReportExportPort`, `DashboardDataPort`, `PageSizePreference`, and `BrowserDownloadPort`, add shared contract tests so production adapters and test doubles preserve the same success, error, cancellation, and unsupported-capability behavior.

### I — Interface Segregation Principle: not met around governance and report data access

`GovernanceService` (`governance.service.ts:15-96`) exposes plans, tasks, board queries, participants, tiers, alerts, rules, emails, and capabilities. Alerts, Action Plans, and Reports inject this same broad service even though each uses only a subset.

Split by consumer capability, for example:

```text
ActionPlansApi       -> plan and board endpoints
ActionTasksApi       -> task commands and history
ParticipantsApi      -> people/tier lookup
AlertsApi            -> inbox/read operations
NotificationRulesApi -> rule CRUD
NotificationLogApi   -> email delivery history
CapabilitiesApi      -> optional platform capabilities
```

Apply the same idea inside Reports: separate catalog/editor, source selection, publication/versioning, and export APIs. These can share a private HTTP utility without exposing a broad public service.

### D — Dependency Inversion Principle: mechanical DI exists; boundary inversion is incomplete

Angular `inject()` correctly supplies dependencies, but injection alone does not ensure that high-level policy is independent of low-level details.

- Components directly depend on concrete HTTP facade classes.
- Components directly call `window.confirm`, `document.createElement`, `URL.createObjectURL`, `history.state`, `localStorage`, and timers.
- `DashboardStore` depends directly on `HttpClient` and knows transport field names.
- Export polling and browser download behavior live in `ReportsPage`.

Introduce narrow tokens/ports only where volatility or environment substitution is real:

```text
REPORTS_CATALOG_PORT
REPORT_EDITOR_PORT
REPORT_EXPORT_PORT
DASHBOARD_DATA_PORT
PAGE_SIZE_PREFERENCE
BROWSER_DOWNLOAD_PORT
CLOCK / SCHEDULER (for polling and timers)
```

Do not add an interface for every class. Keep pure, stable collaborators concrete. Invert transport, browser, time, persistence, and cross-feature boundaries because those are the seams that tests and SSR need to replace.

## Long Parameter List inventory

The automated TypeScript AST scan used a threshold of four parameters. It found nine callables.

| Location | Current signature | Decision | Replacement |
| --- | --- | --- | --- |
| `dashboard-distribution-chart.ts:92` | ECharts callback with 5 parameters | Keep | External library callback signature; document/suppress the metric locally if necessary |
| `dashboard.store.ts:389` | `loadApiSnapshot(filters, metric, analysis, rankingLimit)` | Refactor | `analysis` is unused. Remove it; pass a `DashboardSnapshotQuery` if the remaining values continue to evolve |
| `executions-page.ts:270` | `getCalendarDays(viewDate, selectedIsoDate, minDate, maxDate)` | Delete | Obsolete duplicate; the template already uses `ListFilterDateRange` |
| `governance.service.ts:31` | `board(id, status, page, search, priority)` | Parameter Object | `getBoard(query: ActionBoardQuery)` |
| `reports.service.ts:61` | `update(reportId, expectedVersion, title, description)` | Command Object | `update(command: UpdateReportCommand)` |
| `reports.service.ts:150` | `mutateSources(reportId, kind, operation, expectedVersion, ids)` | Discriminated Command | `mutateSources(command: ReportSourceMutationCommand)`; encode valid kind/operation combinations |
| `reports.service.ts:198` | `requestExport(versionId, format, options, retry, templateVersion)` | Builder + Command | `ReportExportRequestBuilder` creates an immutable `ReportExportRequest`; API accepts one request |
| `list-filter-date-range.ts:149` | `days(view, selected, min, max)` | Parameter Object or computed input | `buildCalendarGrid(options: CalendarGridOptions)` as a pure function |
| `list-filter-date-range.ts:163` | `dayFor(date, selected, min, max, currentMonth)` | Internal context object | Reuse `CalendarGridContext`; no Builder needed |

Near-threshold signatures that still deserve attention:

- `openReport(reportId, navigate = true, preserveError = false)` uses ambiguous Boolean flags. Replace with `openReport(reportId, options?: OpenReportOptions)` or separate public intents.
- `command(task, command, extra)` uses untyped semantic parameters. Replace with a discriminated `ActionTaskCommand`.
- `toggleSelection(kind, id, checked)` and export option mutation can use small typed events emitted by child components.

### Builder Pattern recommendation

Builder should not be the blanket fix for every four-parameter function. Parameter/Command Objects are simpler for flat requests. Builder is appropriate for export because construction has defaults, optional fields, values derived from a version, retry policy, and invariants.

Proposed English-only domain API:

```ts
export interface ReportExportRequest {
  readonly versionId: string;
  readonly format: ExportFormat;
  readonly options: Readonly<ExportOptions>;
  readonly retryFailed: boolean;
  readonly templateVersion: '1' | '2';
}

export class ReportExportRequestBuilder {
  private format: ExportFormat = 'PDF';
  private options: ExportOptions = {};
  private retryFailed = false;

  private constructor(private readonly version: ReportVersion) {}

  static forVersion(version: ReportVersion): ReportExportRequestBuilder {
    return new ReportExportRequestBuilder(version);
  }

  withFormat(format: ExportFormat): this {
    this.format = format;
    return this;
  }

  withOptions(options: ExportOptions): this {
    this.options = { ...options };
    return this;
  }

  retryAfter(job: ExportJob | undefined): this {
    this.retryFailed = job?.status === 'FAILED';
    return this;
  }

  build(): ReportExportRequest {
    return Object.freeze({
      versionId: this.version.id,
      format: this.format,
      options: Object.freeze({ ...this.options }),
      retryFailed: this.retryFailed,
      templateVersion: this.version.content_schema_version >= 2 ? '2' : '1',
    });
  }
}
```

The call site becomes intention-revealing and order-independent:

```ts
const request = ReportExportRequestBuilder.forVersion(version)
  .withFormat(format)
  .withOptions(this.exportOptionsFor(version.id))
  .retryAfter(currentJob)
  .build();

this.reportExports.request(request);
```

Builder responsibilities must stop at valid object construction. HTTP serialization belongs to the export adapter; polling belongs to `ReportExportCoordinator`; DOM download belongs to `BrowserDownloadPort`. This preserves SRP and DIP instead of moving the page's entire workflow into a large Builder.

## Duplication and dead code

### Remove immediately

`ExecutionsPage` imports and renders `ListFilterDateRange` at `executions-page.html:97`, yet retains the old custom datepicker state and methods from approximately `executions-page.ts:104-440`. No current template references `getCalendarDays`, month navigation, day selection, or the two picker-open signals. A spec still calls the obsolete method at `executions-page.spec.ts:286`.

Delete the obsolete implementation and migrate any still-valid date validation tests to the shared date-range component/pure calendar function. Do not wrap dead code in a Builder or service.

### Consolidate by stable concept

- Locale mapping (`pt-BR`, `en-US`, `ko-KR`) is repeated in Alerts, Executions, Scrap Base, and Scrap Review Preview. Expose it from `LanguageService` or a pure locale mapper.
- Currency/number/date formatting is repeated across Dashboard, Kiosk, Reports, Scrap Base, and review components. Prefer Angular pipes in templates and pure formatters outside templates; do not inject pipe classes solely to call `transform()`.
- Page-size persistence is duplicated in Executions and Action Plans. Use a typed `PageSizePreference` with an explicit key and allowed values.
- Pagination transitions and active-filter counting repeat across list pages. Reuse a small composed list-state helper/store only where behavior is identical; avoid a generic base page.
- Set/array selection toggles repeat across Reports, Alerts, Action Plans, and Scrap Base. A pure `toggleSelection` helper can serve typed collections.
- Repeated `subscribe` blocks manually set loading/error flags. Feature stores should own a typed async state (`idle | loading | success | error`) and cancellation policy.
- Reports query-string construction repeats at `reports.service.ts:104-175`. Centralize a private candidate-query serializer inside the Reports data-access layer.

## English and naming standard

The majority of identifiers are already English. The remaining inconsistency is concentrated in comments, embedded UI copy, route/page organization, and a few naming styles.

Adopt these rules:

1. All source identifiers, filenames, comments, JSDoc, test descriptions, architectural types, and internal error keys are English.
2. User-facing copy remains localized. Portuguese, English, and Korean text belongs in the existing translation source or a feature translation file, never inline in component logic/templates.
3. Preserve public URL slugs such as `/relatorios` and `/execucoes` unless product explicitly approves a breaking navigation change. URLs are product contracts, not internal code identifiers.
4. Preserve snake_case at API serialization boundaries. Map transport DTOs to camelCase domain/view models when they enter the feature; do not rename backend contract fields opportunistically.
5. Use one Angular 22 naming convention per feature. Prefer intent-based names such as `reports-data.ts`, `report-editor-store.ts`, and `report-export-coordinator.ts`. Avoid mixing `ReportPreviewComponent` with suffixless component classes.
6. Use `styleUrl` consistently for one stylesheet.
7. Move hard-coded Portuguese labels in `action-plans.ts:100-105`, `action-plans.html:146-176`, and component error strings into translations. Dashboard store labels and fallbacks at `dashboard.store.ts:117-159` must also leave the data/state layer.
8. Convert Portuguese implementation comments in Executions, Scrap Base, Dashboard, theme/layout, and review components to concise English comments. Delete comments that merely restate the next line.

## Target feature architecture

Use vertical feature ownership and composition. This also resolves the current mismatch between `core/README.md`, which says feature-exclusive code belongs in `modules/<feature>`, and the implementation under `pages/`.

```text
app/
  core/
    auth/
    http/
    i18n/
    browser/
  shared/
    ui/
    list/
    formatting/
  features/
    reports/
      reports.routes.ts
      pages/
      ui/
      state/
      domain/
      data-access/
    executions/
    scrap-base/
    dashboard/
    settings/
    action-plans/
    alerts/
```

`features/` versus `modules/` is a naming decision; choose one in an ADR before moving files. The important rules are:

- `core` and `shared` never import feature internals.
- Shared UI has typed inputs/outputs and no endpoint knowledge.
- A feature's route component depends on its state/use cases, not directly on HTTP and browser APIs.
- Data-access maps transport DTOs at the boundary.
- Domain calculations are pure and framework-independent.
- Cross-feature access uses a small public port, not another feature's internal service/models.

## Detailed DX frontend alignment plan

### Architecture decision and scope

Adopt the DX guide's `modules/` name as the canonical feature root. Keep Angular 22 standalone components, functional providers, lazy `loadComponent`, signals, and intent-based filenames; the DX term "module" means a business feature boundary and does not require `NgModule` classes.

Record this decision in an ADR before moving files. The ADR must also document these deliberate Angular 22 adaptations:

- `public/` remains the static-asset root configured by `angular.json`; do not create a duplicate empty `src/assets/` tree;
- the packaged Fustat font remains an npm dependency; create `src/fonts/` only if locally hosted font files become necessary;
- create `environments/` only for genuine build-time variants. Same-origin `/api` URLs do not justify placeholder files;
- no directory is created merely to match a diagram. A directory must contain a real production artifact, test, or ownership document for code that already exists;
- public URL paths (`/relatorios`, `/execucoes`, and the other Portuguese slugs) remain unchanged.

Target structure:

```text
src/app/
  core/
    auth/
    browser/
    http/
    i18n/
    theme/
  layouts/
    dashboard-shell/
  modules/
    action-plans/
    alerts/
    dashboard/
    executions/
    profile/
    reports/
    scrap-base/
    settings/
  shared/
    formatting/
    list/
    ui/
```

Each feature grows only the directories it needs. The complete feature template is:

```text
modules/<feature>/
  <feature>.routes.ts
  pages/          # route entry components and composition only
  ui/             # feature-private presentational components
  state/          # route-scoped stores and coordinators
  domain/         # pure types, commands, policies, calculations
  data-access/    # HTTP clients and transport mappers
  public-api.ts   # only when another feature has an approved dependency
```

Do not create empty `pages/`, `ui/`, `state/`, `domain/`, or `data-access/` folders. Start flat for a small feature and introduce a subdirectory only when it contains at least two cohesive artifacts or clarifies a real boundary.

### Dependency rules

| From | May import | Must not import |
| --- | --- | --- |
| `app` bootstrap/routes | `core`, `layouts`, feature route entry points | feature internals |
| `layouts` | `core`, `shared`, explicit layout ports | `modules/*` internals and feature data clients |
| `modules/<feature>` | its own files, `core`, `shared`, approved public ports | another feature's internal page/store/data-access files |
| `shared` | Angular primitives and other stable shared primitives | `core`, `layouts`, or any feature |
| `core` | Angular/platform primitives and core-local files | layouts or feature internals |

Known violations to remove during migration:

- `DashboardShell` imports `DashboardStatusService` from the Dashboard page tree. Replace this with a layout-owned status port/input or move genuinely application-wide status state to `core`.
- Action Plans imports `ReportsService` and Reports models directly. Define the smallest reporting capability needed by Action Plans and expose it through an approved public port; do not export the entire Reports data-access layer.
- Alerts, Action Plans, and Reports depend on the broad page-level `GovernanceService` and shared page-level governance models. Split these by capability before deleting the old service.
- `ui-icon.ts`, `theme/`, `i18n/`, and the top-level `charts/` folder have ambiguous ownership. Move application-wide facilities to `core`/`shared`; move dashboard-only charts into `modules/dashboard`.

### SOLID rules for the target architecture

#### Single Responsibility

- Route components compose UI and translate route events into store/use-case calls. They do not build URLs, poll jobs, manipulate object URLs, serialize DTOs, or calculate business metrics.
- Presentational components receive typed inputs and emit typed events. They do not inject feature data clients.
- Stores own view state and effect orchestration for one cohesive workflow. Split a store when it develops unrelated loading/error lifecycles or independent reasons to change.
- Data-access clients perform HTTP calls and transport mapping only. They do not own user-facing messages or DOM behavior.
- Pure domain files contain calculations, validation, command construction, and policies without Angular imports.

#### Open/Closed and Liskov Substitution

- Use strategy maps only where behavior genuinely varies by format, source kind, status, or policy. Do not replace a small `switch` with class ceremony.
- Ports must describe observable behavior, errors, and cancellation consistently so in-memory test doubles can replace browser/HTTP implementations without changing callers.
- Preserve transport and URL contracts while internal models migrate. DTO mapping occurs at the `data-access` boundary.

#### Interface Segregation and Dependency Inversion

- Replace `GovernanceService` with narrow capability clients such as action-board query, task command, alert rules, report sources, and report export.
- Introduce injection tokens only at real environment or cross-feature seams: browser download, object URL lifecycle, clock/scheduler, storage, and approved cross-feature capabilities.
- Keep pure helpers and stable local classes concrete. Do not create one interface per class.

### Parameter and construction policy

Use the smallest pattern that makes invalid calls difficult:

| Situation | Preferred pattern | Example |
| --- | --- | --- |
| Flat group of related values | Parameter Object | `getBoard(query: ActionBoardQuery)` |
| State-changing application action | Command Object | `update(command: UpdateReportCommand)` |
| Alternatives with different required fields | Discriminated union | `ReportSourceMutationCommand`, `ActionTaskCommand` |
| Optional behavior flags | Named options or separate intents | `openReport(id, { navigate, preserveError })` |
| Complex construction with defaults, derivation, and invariants | Builder | `ReportExportRequestBuilder` |
| Internal calculation sharing repeated context | Immutable context object | `CalendarGridContext` |
| External callback signature | Keep signature and document exception | ECharts callback |

Builder is not the default response to four parameters. Use it only when construction is staged or order-independent and the final object has meaningful invariants. Builders must return immutable values and must not perform HTTP, polling, storage, translation, or DOM operations.

Parameter acceptance rules:

- public application APIs should have no more than three positional parameters;
- Boolean positional parameters are prohibited in public application APIs;
- command/query types are `readonly` and named by intent;
- API snake_case stays inside transport DTOs; domain and view models use camelCase;
- discriminated unions must be exhaustively checked;
- framework and external-library callback exceptions are documented locally.

### Idiomatic Angular 22 rules

- Keep standalone components and lazy route loading.
- Use `inject()` consistently; constructor injection is not required merely because the DX guide predates modern Angular.
- Prefer `signal` and `computed` for local synchronous state. Use RxJS for event streams, cancellation, polling, and HTTP composition where it remains clearer.
- Avoid `effect()` for state propagation that can be expressed as `computed`, `linkedSignal`, or an explicit command.
- Scope feature stores/providers at the route or feature entry point unless state is intentionally global.
- Prefer Angular pipes in templates and pure formatters outside templates; do not inject pipe classes only to call `transform()`.
- Use one naming style per migrated feature. Prefer intent-based names such as `reports-data.ts`, `report-editor-store.ts`, and `report-export-coordinator.ts`; retain `.model.ts`/`.models.ts` only for type contracts.
- Keep `.ts`, `.html`, `.css`, and `.spec.ts` basenames aligned.
- Preserve SSR safety: browser globals are accessed only through guarded adapters.

### Migration work packages

#### WP0 — Baseline and architecture contract

- [ ] Write the DX/Angular 22 ADR and the dependency matrix.
- [ ] Capture a route inventory and current lazy chunk names.
- [ ] Add characterization tests for route URLs and the critical Reports/Executions workflows.
- [ ] Apply the existing Prettier backlog as an isolated mechanical change.
- [ ] Add `architecture:check` and `quality:check` scripts without changing application behavior.

Acceptance: tests, build, formatting, and architecture checks have reproducible commands; no production file has moved yet.

#### WP1 — Core, shared, layout, and empty-folder cleanup

- [ ] Move `i18n` and `theme` under `core` with import-only changes.
- [ ] Move `ui-icon` and proven reusable formatting/list primitives under `shared`.
- [ ] Move dashboard-only chart code into the Dashboard feature.
- [ ] Remove empty placeholder directories that have no immediate implementation.
- [ ] Replace the layout-to-Dashboard internal import with a layout-safe port or input.
- [ ] Keep `public/` as the documented Angular 22 equivalent of DX `assets/`.

Acceptance: `core`, `shared`, and `layouts` contain only code matching their ownership rules; none imports a feature internal.

#### WP2 — Profile pilot

- [ ] Move `pages/profile` into `modules/profile` and replace the placeholder README with real ownership documentation.
- [ ] Add `profile.routes.ts` and lazy-load it from the application route table.
- [ ] Keep profile data access local and consume only the narrow authenticated-user capability from `core/auth`.
- [ ] Align filenames/classes within Profile without a repository-wide rename.

Acceptance: `/perfil` behavior is unchanged; the feature passes targeted tests, full tests, SSR build, and architecture checks. Use this migration to validate the process before larger features.

#### WP3 — Executions and list primitives

- [ ] Delete the obsolete custom datepicker implementation and obsolete test.
- [ ] Introduce `CalendarGridOptions`/`CalendarGridContext` in the shared date-range implementation.
- [ ] Move Executions into `modules/executions` with feature routes, data access, list state, detail UI, and upload UI separated by responsibility.
- [ ] Introduce a typed page-size preference and scheduler/clock seam only where tests require substitution.
- [ ] Complete dialog focus management and keyboard behavior.

Acceptance: no duplicate calendar logic, no long public signature, equivalent polling/upload/detail behavior, and preserved `/execucoes` URL.

#### WP4 — Reports contracts and Builder

- [x] Add `UpdateReportCommand`, `ReportSourceMutationCommand`, candidate queries, and export request types in `domain`.
- [x] Implement `ReportExportRequestBuilder` with immutable output and focused unit tests for defaults, schema version, options copying, and retry behavior.
- [x] Extract `ReportExportCoordinator` for polling and `BrowserDownloadPort` for download/object URL behavior.
- [x] Split Reports export data access into its own capability client.
- [x] Centralize candidate-query serialization.
- [ ] Move Reports into `modules/reports` with route shell, editor state, feature UI, domain, and data-access boundaries.
- [ ] Expose only the approved report lookup capability required by Action Plans.

Acceptance: the Builder constructs only a valid request; HTTP serialization, polling, and DOM download remain separate; Reports public APIs have no long positional parameter lists.

#### WP5 — Governance capability split

- [ ] Define discriminated `ActionTaskCommand` variants with required payloads per action.
- [ ] Replace `board(id, status, page, search, priority)` with `getBoard(query)`.
- [ ] Split `GovernanceService` and shared models into Action Plans and Alerts capabilities plus explicitly shared contracts.
- [ ] Move Action Plans and Alerts into their respective module folders with feature routes and route-scoped state.
- [ ] Remove direct Action Plans imports from Reports internals.

Acceptance: the old broad `GovernanceService` is deleted; each feature depends only on the operations and models it uses.

#### WP6 — Scrap Base and Settings

- [ ] Move Scrap Base/Review into one feature boundary with separate list, review, attachment, and template capabilities.
- [ ] Move object URL creation/revocation behind an attachment preview adapter and verify cleanup on replacement/removal/destroy.
- [ ] Move Settings into its module and split tab/capability state.
- [ ] Extract target-plan and classification calculations into pure domain functions.

Acceptance: object URLs cannot leak, Settings calculations run without Angular TestBed, and no feature-private review type resides in `shared`.

#### WP7 — Dashboard, Kiosk, and final structure

- [ ] Move Dashboard/Kiosk into `modules/dashboard`, including feature-only charts and translations.
- [ ] Remove the unused `analysis` parameter from snapshot loading; introduce `DashboardSnapshotQuery` only if the remaining query is evolving.
- [ ] Separate transport mapping, KPI calculations, localization, and view state.
- [ ] Replace width animations after visual regression comparison.
- [ ] Delete the obsolete top-level `pages/`, `charts/`, `i18n/`, and `theme/` directories once empty.

Acceptance: every navigable feature is under `modules/`; no compatibility re-export or empty placeholder directory remains.

#### WP8 — Enforcement and closeout

- [ ] Enforce allowed import directions and prohibit cross-feature internal imports.
- [ ] Enforce no component-level `HttpClient`, no unapproved direct browser globals, and review of public signatures with four or more parameters.
- [ ] Run keyboard, focus, 320 px, 200% zoom, light/dark, Portuguese/English/Korean, reduced-motion, and SSR checks.
- [ ] Update architecture documentation and the knowledge graph.
- [ ] Remove temporary compatibility aliases only after all consumers migrate.

Acceptance: `npm test -- --watch=false`, `npm run build`, `npm run format:check`, and the architecture check all pass; the directory tree matches the ADR and DX ownership rules.

### Per-PR migration checklist

Each work package should be split into reviewable pull requests. A single PR moves at most one feature boundary or introduces one cross-cutting contract family.

- [ ] Add or confirm characterization tests before structural changes.
- [ ] Separate mechanical moves/renames from behavior changes whenever practical.
- [ ] Use temporary re-exports only with a removal task in the same work package.
- [ ] Verify lazy loading, route titles, guards, deep links, and SSR.
- [ ] Run targeted tests, the complete test suite, build, formatting, and architecture checks.
- [ ] Review the diff for accidental public URL, translation key, DTO, or CSS selector changes.
- [ ] Update this report's status table and the graph after merge.

### Recommended execution order

Execute `WP0 → WP1 → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 → WP8`. Profile is the low-risk pilot; Executions validates shared list/date behavior; Reports establishes the complex command/Builder boundaries; governance features migrate only after the Reports public capability is available. This order prevents folder moves from preserving the current dependency violations under new paths.

## Technical frontend audit

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Accessibility | 2/4 | Good landmarks/labels in many areas, but the Executions detail is opened only by a clickable `<tr>` (`executions-page.html:167`) with no keyboard equivalent. Several custom dialogs in Alerts/Action Plans lack labelled-by/focus management/focus trap/return-focus behavior. |
| Performance | 3/4 | Lazy routes and deferred charts are positive. Risks: oversized feature surfaces, width transitions reported by the detector, repeated template-called formatting, and unreleased object URLs in Scrap Review. |
| Responsive design | 3/4 | Main screens have mobile breakpoints and table frames. Large tables still rely heavily on horizontal density; keyboard/touch behavior should be verified at 320 px and 200% zoom after decomposition. |
| Theming | 3/4 | Tokens dominate. Scattered raw colors and fallback values remain, especially in Settings, Kiosk, attachments, and review overlays. |
| Implementation integrity | 2/4 | Product-specific system and shared controls are visible, but architecture, localization, file sizing, and quality gates are inconsistent. |
| **Total** | **13/20** | **Acceptable; significant refactoring required** |

Implementation integrity verdict:

- Product/visual coherence: **PASS with reservations**. The Hanaro identity, dashboard vocabulary, states, and shared list language are recognizable.
- Engineering coherence against the requested strict SOLID standard: **FAIL** until feature boundaries, commands/ports, dead code, and quality gates are corrected.

Verified UI findings:

- `executions-page.html:167`: clickable table row is not keyboard-focusable and contains no equivalent action button. This is a WCAG 2.1.1 keyboard failure. Add a real button/link in the row; row click may remain only as a redundant pointer convenience.
- Custom drawers in `alerts.html:170`, `action-plans.html:312`, and `action-plans.html:410` declare dialogs but do not show the focus initialization used by the bulk-review dialog. Standardize on CDK Dialog/Overlay or a shared accessible dialog shell with focus trap, Escape, labelled title, and return focus.
- `scrap-review-drawer.ts:127-133` creates object URLs inside a computed value without revoking them. Recalculation/file removal can retain blobs. Move URL lifecycle into an attachment preview service/store and revoke on removal/destroy.
- Detector findings at `dashboard-kiosk-page.css:290,448,1003` and `settings-page.css:978` animate width. Prefer `transform: scaleX()` with an appropriate transform origin when animation is needed.
- Detector “broken image” findings for bound `[src]` elements are false positives; all inspected instances provide `[alt]`.
- The side accent borders reported in Kiosk and Settings are visual-polish findings only, not SOLID or release blockers.

## Quality-gate findings

### Unit tests

The test run reported 5 failures. The first concrete failure is `reports.service.spec.ts:48`, where `expectOne()` expects a URL without query parameters while the request includes them. This leaves an open request, after which TestBed setup/verification failures cascade into later Reports/Executions service tests.

Fix the first request matcher to use a predicate on `candidate.url` (as already done at `reports.service.spec.ts:22`), flush it, and rerun the suite before diagnosing the remaining four as independent product defects.

### Formatting

`npm run format:check` reports 11 files, including Action Plans, Alerts, Reports, Governance copy, and the new report preview. Formatting should be a required pre-merge check. Run the formatter only in a dedicated mechanical commit/PR so behavioral review remains readable.

### Missing architecture enforcement

No lint/architecture command is defined in `frontend/package.json`. Add incremental rules for:

- feature-to-core/shared dependency direction;
- no cross-feature internal imports;
- no component-level `HttpClient`;
- no untranslated user-facing literal outside translation files (with explicit exceptions);
- a four-parameter review threshold, allowing external callback signatures;
- no unapproved direct browser globals outside browser adapters;
- complexity/file-size warnings used as review triggers, not arbitrary reasons to split cohesive code.

## Prioritized backlog

| ID | Priority | Status | Finding and acceptance outcome |
| --- | --- | --- | --- |
| FE-SOLID-01 | P1 | In progress — export, API client, history and draft state extracted | Split Reports vertically. The route shell no longer owns export polling, DOM download, source mutation, and every editor section; current URLs and behavior remain unchanged. |
| FE-SOLID-02 | P1 | Not started | Remove obsolete Executions datepicker code and split list/detail/manual upload. Shared date-range behavior owns calendar tests. |
| FE-SOLID-03 | P1 | Not started | Replace `GovernanceService` with capability clients/ports and typed DTOs/discriminated commands. `object`, `string` command, and arbitrary record parameters disappear from public APIs. |
| FE-SOLID-04 | P1 | In progress — execution row control completed | Fix keyboard access for Executions rows and standardize accessible dialog focus behavior across main screens. |
| FE-SOLID-05 | P1 | In progress — Reports request matcher completed | Restore tests and formatting gates. `npm test -- --watch=false`, `npm run build`, and `npm run format:check` all pass before structural migration. |
| FE-SOLID-06 | P2 | Not started | Separate Dashboard transport mapping, KPI calculations, localization, and state; remove the unused `analysis` parameter. |
| FE-SOLID-07 | P2 | Not started | Move Scrap review workflow to a store/coordinator and fix object URL lifecycle. |
| FE-SOLID-08 | P2 | Not started | Split Settings by tab/capability and extract pure target-plan calculations. |
| FE-SOLID-09 | P2 | Not started | Consolidate locale, formatting, page-size persistence, selection toggles, and identical list-state behavior through composition. |
| FE-SOLID-10 | P2 | Not started | Move all user copy to translation sources and convert code comments/names to English while preserving URLs and transport contracts. |
| FE-SOLID-11 | P2 | Not started | Add browser/time/download/storage ports at real environment seams; remove direct globals from feature policy code. |
| FE-SOLID-12 | P2 | Not started | Replace width animations and consolidate remaining raw theme values after visual regression checks. |
| FE-SOLID-13 | P2 | Not started | Record and enforce one feature directory/naming convention; migrate one vertical slice at a time. |
| FE-SOLID-14 | P2 | Not started | Split Action Plans and Alerts editors from their list routes and move task/rule logic to typed stores/use cases. |
| FE-SOLID-15 | P3 | Not started | Normalize suffixless Angular 22 class/file naming and `styleUrl` during each feature migration, not globally in one risky rename. |
| FE-SOLID-16 | P3 | Not started | Revisit detector-reported side-accent styling only during a visual polish pass. |

## Delivery plan

### Phase 0 — Stabilize the baseline

- [x] Fix the Reports request matcher for paginated action candidates.
- [x] Rerun the complete test suite (125 tests passing).
- Apply Prettier in a separate mechanical change.
- Add characterization tests for Reports autosave/conflict/publish/export and Executions polling/detail/upload.
- Capture desktop/mobile screenshots for the main routes before structural changes.

Acceptance: build, tests, and formatting pass; refactoring can be judged as behavior-preserving.

### Phase 1 — Contracts and English standard

- Add command/query types for action board, report update/source mutation/export, and calendar grid.
- Implement `ReportExportRequestBuilder` and make the export API accept one immutable request.
- Introduce discriminated task commands and remove `object`/arbitrary `string` from public service signatures.
- Move inline Portuguese UI text to translation sources; translate implementation comments to English.

Acceptance: no public application function in the scanned set has more than three positional parameters, except documented framework/library callbacks.

### Phase 2 — Reports pilot

- Extract presentational components first.
- [x] Expand the route-scoped `ReportEditorStore` to own version-history, draft, and save-status state, without turning it into another god object.
- Extract source selection, publication/version, export coordinator, and browser download adapter.
- Split the data-access service by capability.

Acceptance: route shell is a composition boundary; each extracted unit has one reason to change; URLs, autosave conflict behavior, snapshots, and exports are preserved.

### Phase 3 — Executions and shared utilities

- Delete obsolete datepicker state/methods/spec.
- Extract list store, detail drawer, and manual-upload dialog.
- Add shared locale/formatting/page-size preference utilities where reuse is proven.
- Add accessible table action and dialog shell behavior.

Acceptance: equivalent UI behavior with materially smaller route component and no duplicate calendar implementation.

### Phase 4 — Remaining feature slices

Proceed in this order: Scrap Base/Review, Settings, Dashboard/Kiosk, Action Plans, Alerts, then Profile cleanup. Keep structural and behavior changes in separate PRs.

Acceptance: feature-private data, state, domain, and UI boundaries are explicit; no shared/core dependency points into a feature.

### Phase 5 — Enforcement and final UI pass

- Add architecture/language/parameter rules to CI incrementally.
- Run keyboard, 320 px, 200% zoom, light/dark, English/Korean, SSR, and reduced-motion checks.
- Rerun the technical UI audit and compare the score.

Acceptance: all gates pass, documented exceptions are narrow, and architecture rules prevent regression.

## Definition of done

The refactoring is complete only when:

- all production behavior and public URLs are preserved unless a separate product change is approved;
- build, all tests, formatting, and architecture checks pass;
- route components act as composition boundaries;
- public feature APIs use typed commands/queries and no Long Parameter List remains without a documented external-signature exception;
- the Builder constructs only the complex export request and does not absorb transport or workflow behavior;
- code identifiers/comments/tests are English, while UI copy is fully localized;
- direct browser/time/storage dependencies are behind explicit adapters where substitution matters;
- keyboard, focus, responsive, theme, SSR, and reduced-motion checks pass;
- no “god store” merely replaces a god component;
- the knowledge graph is updated after code changes.

This report complements the existing `docs/backlog-arquitetura-solid.md`: that backlog remains the broader architecture program, while this document supplies the current frontend evidence, Long Parameter List inventory, Builder design, and executable migration sequence.
