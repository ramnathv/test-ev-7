# Prompt: fix `basePath` inconsistency in `link` props

Paste the section below into a Claude Code session opened in your Evidence fork.

Findings verified against `@evidence-dev/core-components` 5.4.2 / Evidence v40.1.8, by
building a project twice — with `basePath: ""` and `basePath: "/foo"` — and reading the
emitted HTML.

---

Fix an inconsistency in how `link` props handle `deployment.basePath`.

## The bug

`addBasePath` is applied to link navigation by some components and not others:

| Component | Click navigation | Crawled at build |
|---|---|---|
| Markdown links, `LinkButton`, `BigValue`, `DataTable` | `addBasePath` ✅ | ✅ |
| `USMap` | **raw** ❌ | ✅ via `InvisibleLinks` |
| `PointMap` / `BubbleMap` / `AreaMap` | **raw** ❌ | ❌ none |

Two user-visible failures under a non-empty `basePath`:

1. **USMap prerenders a correct href, then 404s on click.** Its `InvisibleLinks` crawl
   applies `addBasePath`; its click handler doesn't. Same component, two answers.
2. **Leaflet maps don't crawl at all**, so a templated page reachable only from a point,
   bubble, or area is silently missing from a static build.

## Where it lives

Paths below are `dist/` (from node_modules); find the corresponding `src/lib/` sources in
`packages/ui/core-components` — confirm by filename rather than trusting this mapping.

- `unsorted/viz/map/_USMap.svelte` (~line 150) — `mapData[i].link = data[i][link]`, raw.
  Consumed by `packages/lib/component-utilities/src/echartsMap.js` (~line 100):
  `window.location = params.data.link`.
- `unsorted/viz/map/components/Point.svelte` (~line 43) and `MapArea.svelte` (~line 43) —
  pass `item[link]` raw into `EvidenceMap.js` → `addCircle`, which does
  `window.location.href = link`.
- Reference implementations that are already correct:
  `unsorted/viz/table/TableRow.svelte`, `unsorted/viz/core/_BigValue.svelte`,
  `atoms/InvisibleLinks.svelte`.

Out of scope: `_SankeyDiagram.svelte`'s `link*` props are graph edges, not hyperlinks.

## The fix

**Normalize at the point the link value is read from the row, inside core-components** —
not in `echartsMap.js` / `EvidenceMap.js`. Those are low-level renderers, and
core-components already imports `addBasePath` from `@evidence-dev/sdk/utils/svelte`.

1. Wrap the three raw reads above in `addBasePath(...)`.
2. Render `<InvisibleLinks {data} {link} />` from `PointMap`, `BubbleMap`, and `AreaMap`
   when a `link` prop is set, matching how `_USMap.svelte` and `_DataTable.svelte` do it.

**Do not normalize by transforming the `data` prop upstream.** This was tried and it does
not work — see "What I ruled out" below. The link value must be rewritten where it is read
off the row, which is what step 1 does.

**This is backward compatible.** `addBasePath` is idempotent — it returns the path
untouched when it already starts with the base path — so dashboards that currently work
around this by hardcoding `/base/...` in their map link columns keep working. Confirmed
directly against `packages/lib/sdk/src/utils/svelte/addBasePath.js`:

| Input | `basePath: "/foo"` | `basePath: ""` |
|---|---|---|
| `/states/California` | `/foo/states/California` | unchanged |
| `/states/New York` | `/foo/states/New York` | unchanged |
| `/foo/states/Ohio` | unchanged (idempotent) | unchanged |

## Reference implementation

`components/LinkedUSMap.svelte` and `components/withBasePath.js` in the project that found
this bug implement the same normalisation at the project level, as a wrapper around the
built-in `<USMap>`. Worth reading before starting — the transform in `withBasePath.js` is
exactly what step 1 needs to do, and `LinkedUSMap` is a working end-to-end demonstration
(builds green under both `basePath: ""` and `basePath: "/test-ev-7"`).

Note the import that makes it work without hardcoding anything:

```js
import { addBasePath } from '@evidence-dev/sdk/utils/svelte';
```

That export is **already bound to the loaded config** (`packages/lib/sdk/src/utils/svelte/index.js`
closes over `config` and re-exports a one-arg version), so callers never pass or know the
base path. The two-arg form in `addBasePath.js` is the unbound one.

## What I ruled out

**Transforming the `data` prop before it reaches the map.** This is the obvious fix and it
works for `USMap`, whose wrapper accepts a plain array through its own `QueryLoad`. It
**fails for the Leaflet maps**: `unsorted/viz/map/components/Points.svelte` (~line 331)
consumes `data` as a Query *store*, not an array —

```svelte
{#if data && data.length > 0}
  {#await Promise.all([map.initPromise, data.fetch(), init($theme)]) then}
    {#each $data as item}
```

`$data`, `data.fetch()` and `data.length` together mean a transformed plain array satisfies
none of the contract, and the page 500s during prerender. Verified by bisection: a wrapper
around `USMap` alone builds clean, and adding the equivalent `PointMap` wrapper fails the
build with an `Internal Error` on that route. So the fix has to live where `item[link]` is
read, which is why step 1 targets `Point.svelte` / `MapArea.svelte` rather than the map
wrappers.

**One implementation note:** `InvisibleLinks` is not exported from the package barrel
(`dist/index.js` → `atoms/index.js` does not re-export it). That is fine for step 2 since
`PointMap`/`BubbleMap`/`AreaMap` are inside the same package and can import it by relative
path, but it does block any out-of-package reuse, and may be worth exporting while you are
there.

While you're in `addBasePath` (`packages/lib/sdk/src/utils/svelte/addBasePath.js`): the
`_path.startsWith(basePath)` guard has no path-segment boundary check, so with
`basePath: "/foo"` a genuine link to `/foobar/x` is wrongly treated as already-prefixed.
Worth fixing as a separate commit, or leaving alone if it's load-bearing elsewhere.

## Verify

Build a test project twice, with `basePath: ""` and `basePath: "/foo"`, using a templated
page (`pages/states/[state].md`) linked from a DataTable, a USMap, and a PointMap.

- Emitted hrefs and click targets both carry the base path in every component.
- The PointMap-only route is prerendered into `build/` after the fix, and absent before it.
- With `basePath: ""` nothing changes — `addBasePath` is a no-op there, so this is the
  regression case that must stay identical.
- The Leaflet maps still render. Because `Points.svelte` treats `data` as a store, any
  change near the `link` read is close to code that assumes a live Query — a map that
  renders under `basePath: ""` but goes blank under a base path means the Query contract
  got broken, not the link.

Add unit tests alongside the existing core-components tests, and check whether the docs
site (`sites/docs`) documents the current raw behaviour for `link` anywhere.

A ready-made harness for the manual pass: <https://github.com/ramnathv/test-ev-7>. Its
`pages/link-tests/from-map.md` puts a wrapped `<LinkedUSMap>` and a raw `<USMap>` on the
same page, so under a base path the first navigates correctly and the second 404s — a
direct before/after on one screen. Deployed at
<https://ramnathv.github.io/test-ev-7/link-tests>, which builds with `basePath: /test-ev-7`.

---

## Notes for the PR

**Lead with the USMap asymmetry.** A component that prerenders a correct href and then
404s when you click it is indefensible as intended behaviour. "Leaflet maps don't crawl"
is the weaker half of the argument — a maintainer could reasonably call that a deliberate
scoping choice.

**Expect a question about breaking changes.** Anyone who hit this already worked around it
by hardcoding the base path into their map link columns. Idempotency in `addBasePath` is
the answer: those links start with the base path, so they're returned untouched.
