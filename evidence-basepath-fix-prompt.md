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

**This is backward compatible.** `addBasePath` is idempotent — it returns the path
untouched when it already starts with the base path — so dashboards that currently work
around this by hardcoding `/base/...` in their map link columns keep working.

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

Add unit tests alongside the existing core-components tests, and check whether the docs
site (`sites/docs`) documents the current raw behaviour for `link` anywhere.

---

## Notes for the PR

**Lead with the USMap asymmetry.** A component that prerenders a correct href and then
404s when you click it is indefensible as intended behaviour. "Leaflet maps don't crawl"
is the weaker half of the argument — a maintainer could reasonably call that a deliberate
scoping choice.

**Expect a question about breaking changes.** Anyone who hit this already worked around it
by hardcoding the base path into their map link columns. Idempotency in `addBasePath` is
the answer: those links start with the base path, so they're returned untouched.
