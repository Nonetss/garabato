## ADDED Requirements

### Requirement: Layered frontend component ownership

The frontend SHALL separate product-agnostic UI primitives, application-shared
visual patterns, application runtime providers and feature-owned code into
explicit layers. `components/ui` MUST NOT import from `components/shared` or
`features`, `components/shared` MUST NOT import from `features`, and providers
MUST live in `apps/frontend/src/providers` and be mounted at an application,
island or feature-page boundary rather than hidden inside a visual layout
component.

#### Scenario: A shared pattern composes a primitive

- **WHEN** an application-shared component needs a button, dialog or input
- **THEN** it SHALL compose the corresponding `components/ui` primitive without
  introducing a dependency from the primitive back to the shared layer

#### Scenario: A React island needs query context

- **WHEN** a feature page and its sibling overlays require the query client
- **THEN** one provider SHALL wrap their common island boundary and shared visual
  components SHALL remain provider-agnostic

### Requirement: Cohesive shared component taxonomy

Application-shared components SHALL be classified under the semantic domains
`brand`, `data-display`, `feedback`, `form`, `layout`, `navigation`, `resource`
or `user`. The `resource` domain SHALL own the high-level declarative resource
composition API and its typed definition/view-model contracts, while lower-level
visual primitives remain in their intent-specific domains.

#### Scenario: A declarative resource component is added

- **WHEN** a component coordinates resource identity, filters, query states or
  descriptor-driven entity rendering as part of the shared resource API
- **THEN** its public implementation SHALL be placed in the
  `components/shared/resource` domain

#### Scenario: A lower-level metadata component is reused

- **WHEN** a component only renders generic metadata independently of a resource
  page
- **THEN** it SHALL remain in `components/shared/data-display` rather than move
  into the resource orchestration layer

### Requirement: Semantic feature slices

Features SHALL live under `apps/frontend/src/features/<domain>/`. Every
directory directly below `features/<domain>/` SHALL represent a named product
use case, a feature-local `shared` slice or the domain's public `index.ts`.
Technical directories such as `components`, `hooks`, `definitions`, `model` and
`schemas` MUST live inside a semantic use-case or feature-local shared slice
rather than beside `overview`, `detail` or another use case.

#### Scenario: A feature has overview and detail routes

- **WHEN** a domain exposes both an overview and a detail surface
- **THEN** it SHALL place their technical files below separate `overview/` and
  `detail/` slices, with common domain code below `shared/`

#### Scenario: A feature currently has one surface

- **WHEN** a domain has only one use case
- **THEN** it SHALL still use a semantic slice such as `overview`, `workspace` or
  `sign-in` instead of placing technical folders at the domain root

### Requirement: Standard slice internals

A semantic feature slice SHALL classify React views under `components`, static
typed renderer configuration under `definitions`, React state and effects under
`hooks`, framework-independent domain logic under `model`, optional runtime
validation under `schemas`, and its public API under `index.ts`. Empty category
directories MUST NOT be created only to represent unused layers.

#### Scenario: A resource page is implemented declaratively

- **WHEN** a feature supplies a static resource definition and a runtime page
  view model
- **THEN** the definition SHALL live under `definitions`, the composing hook
  SHALL live under `hooks`, pure transformations SHALL live under `model` and
  the route-level React component SHALL live under `components`

#### Scenario: A definition requires rich leaf rendering

- **WHEN** a static typed definition needs JSX for a supported rich leaf value
- **THEN** it SHALL use a `.definition.tsx` module without taking ownership of
  queries, mutations or React state

### Requirement: Feature-local shared ownership

A feature-local `shared` slice SHALL contain only code consumed by at least two
semantic slices in the same feature domain. Single-slice behavior MUST remain in
its owning slice, and code required by unrelated feature domains MUST be exposed
through an intentional public owner or promoted to an application-shared layer.

#### Scenario: Overview and detail share a query hook

- **WHEN** both slices consume the same domain query or mutation hook
- **THEN** the hook SHALL live under the domain's `shared/hooks` directory

#### Scenario: Only detail consumes a renderer

- **WHEN** a renderer is used only by the detail surface
- **THEN** it SHALL remain under `detail/components` even if it appears visually
  generic

### Requirement: Explicit feature import boundaries

Every semantic slice SHALL expose a narrow public API from `index.ts`. Astro
pages and other feature domains MUST consume the owning slice or domain through
a public entry point, while files inside the owning slice SHALL use direct
internal imports and MUST NOT import their own barrel. Cross-slice consumers
MUST NOT reach into another slice's private technical folders. A domain root
`index.ts` SHALL exist only when something imports the domain itself.
Frontend-internal imports SHALL use the `@/` absolute alias rather than
relative paths.

#### Scenario: Astro mounts a route page

- **WHEN** an Astro route imports its client-only React page component
- **THEN** it SHALL import that component from a public feature or slice entry
  point and retain `client:only="react"`

#### Scenario: One feature needs another feature's type

- **WHEN** a feature intentionally consumes a type owned by another domain
- **THEN** that type SHALL be explicitly exported by the owning public entry
  point rather than imported from its private `model` directory

#### Scenario: A slice imports its own component

- **WHEN** a component inside a slice consumes another private module from the
  same slice
- **THEN** it SHALL import the direct internal `@/features/...` path rather than
  the slice's `index.ts`

#### Scenario: Two sibling slices consume each other

- **WHEN** two slices of the same domain both need the other's types or hooks and
  routing that through `index.ts` would create a page-level import cycle
- **THEN** each owning slice SHALL publish the cycle-free subset from a
  `public.ts` entry point re-exported by its own `index.ts`, and the sibling
  SHALL import that entry point instead of a private technical folder

#### Scenario: A container domain is mounted slice by slice

- **WHEN** a domain such as `admin` or `app-shell` is only consumed through its
  slices
- **THEN** it SHALL NOT have a root `index.ts` barrel

### Requirement: Semantic frontend naming

Frontend folders and files SHALL use kebab-case names that describe product
domains, use cases and stable component roles. Route-level React islands SHALL
use the `*-page.tsx` suffix, hooks SHALL use the `use*` convention, and static
renderer definitions SHALL use `.definition.ts` or `.definition.tsx`. Generic
positional names such as `main` and scope-only names such as `global` MUST be
replaced when a product-language name is available.

#### Scenario: A default resource route is named

- **WHEN** a route lists or summarizes the resources in a domain
- **THEN** its slice SHALL use a semantic name such as `overview` and its root
  React island SHALL use a `*-page.tsx` filename rather than `main`

#### Scenario: A route island is split from its surface

- **WHEN** a route-level React island needs a runtime provider or page shell
  around its actual surface
- **THEN** the `*-page.tsx` file SHALL contain only that boundary component and
  the surface SHALL live in a sibling `*-content.tsx` exporting `<Name>Content`

#### Scenario: Application shell code is organized

- **WHEN** components own authenticated navigation, guest navigation or the
  global application frame
- **THEN** they SHALL belong to an `app-shell` domain or one of its semantic
  slices rather than a feature named `global`

### Requirement: Behavior-preserving structural migration

The frontend organization migration SHALL preserve routes, authorization,
queries, mutations, Astro island directives and intended rendered behavior.
Obsolete paths MUST be removed only after all consumers have moved.

#### Scenario: A domain is moved into slices

- **WHEN** a feature domain is reorganized
- **THEN** its Astro routes, public component props, permissions and runtime data
  behavior SHALL remain equivalent after imports are redirected

### Requirement: Durable architecture documentation

Repository instructions and OpenSpec project context SHALL describe the actual
`apps/frontend/src/features` location, semantic slice hierarchy, component
layers, public import boundaries and feature-to-shared promotion rule. A
feature-owned component SHALL be promoted to an application-shared API only
when at least three production consumers share the same intent, except for a
cross-cutting correctness boundary.

#### Scenario: A developer adds a new feature file

- **WHEN** a developer or agent consults the repository instructions
- **THEN** the documented rules SHALL identify its semantic owner, technical
  subfolder and permitted dependency direction without requiring inference from
  neighboring files

#### Scenario: Similar components are considered for extraction

- **WHEN** visually similar feature components do not have three production
  consumers with the same intent
- **THEN** they SHALL remain feature-owned unless they enforce an established
  cross-cutting correctness boundary
