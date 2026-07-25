---
title: Templated page link tests
---

Test harness for templated pages reached from tables and maps. Two entry-point pages
generate links; both point into the same templated pages under `pages/states/`, so a bug in
either link mechanism shows up as a mismatch between them.

## Entry points

<Grid cols=2>

<LinkButton url="/link-tests/from-table">Links from a table →</LinkButton>

<LinkButton url="/link-tests/from-map">Links from a map →</LinkButton>

</Grid>

## What is being tested

| # | Test | Where |
|---|------|-------|
| 1 | `<DataTable link=…>` navigates to a templated page | [from-table](/link-tests/from-table) |
| 2 | Generated link strings are visible for inspection | [from-table](/link-tests/from-table) |
| 3 | Markdown links from an `{#each}` loop | [from-table](/link-tests/from-table) |
| 4 | Deep links into a two-parameter nested template | [from-table](/link-tests/from-table) |
| 5 | A page with data that is linked from nowhere | [from-table](/link-tests/from-table) |
| 6 | Invalid, no-data, and wrong-case parameters | [from-table](/link-tests/from-table) |
| 7 | The same target reached three different ways | [from-table](/link-tests/from-table) |
| 8 | `<USMap link=…>` navigates to a templated page | [from-map](/link-tests/from-map) |
| 9 | A map that deep-links into the nested template | [from-map](/link-tests/from-map) |
| 10 | `<PointMap link=…>` and `<BubbleMap link=…>` | [from-map](/link-tests/from-map) |
| 11 | A map with no `link` prop stays inert | [from-map](/link-tests/from-map) |

## The templated pages themselves

| File | Route | Purpose |
|------|-------|---------|
| `pages/states/[state]/index.md` | `/states/<state>` | One parameter; static frontmatter title + `hide_title`, dynamic `# {params.state}` in the body |
| `pages/states/[state]/[category].md` | `/states/<state>/<category>` | Two parameters; no frontmatter, dynamic heading only |

Both pages print their resolved parameters near the top and both guard the empty case with
an `{#if}` block, so an encoding bug or a bad parameter is visible on the page rather than
showing up as a broken component.

## The three things most likely to break

**Values containing spaces.** Nine states are multi-word and all four categories are, so
every link on this site except a handful exercises this. Both templated pages echo their
parameters back so you can confirm a space survived the round trip rather than arriving as
`%20` or getting truncated.

**Relative links, which silently compound.** Every link here — markdown, `LinkButton url`,
and every `link` column — is **root-absolute with a leading slash**. Drop the slash and the
browser resolves the href against the current directory, so `link-tests/from-map` clicked
from `/link-tests/` becomes `/link-tests/link-tests/from-map`. `addBasePath` does not save
you: it is a no-op while `deployment.basePath` is empty, which is the default here.

**Base-path handling, which is not uniform.** Verified against
`@evidence-dev/core-components` 5.4.2:

| Link mechanism | Click navigation | Crawled at build? |
|---|---|---|
| Markdown link | `addBasePath` | yes |
| `<LinkButton url=…>` | `addBasePath` | yes |
| `<DataTable link=…>` | `addBasePath` | yes |
| `<USMap link=…>` | **raw** `window.location` | yes, via `InvisibleLinks` |
| `<PointMap link=…>` / `<BubbleMap link=…>` | **raw** `window.location` | **no** |

Two consequences, both invisible while the base path is empty. Under a non-empty base path,
map link columns must include it themselves — the other mechanisms get it applied for them.
And PointMap/BubbleMap links are never crawled, so a templated page reachable *only* from a
point or bubble will not be prerendered into a static build.

**Which pages get built.** `npm run dev` resolves routes on demand, so any URL you type
works. `npm run build` prerenders only the parameter values it found a link to. Test 5 uses
Alaska — real data, linked from nowhere — to make that difference visible. Check both:

```bash
npm run dev                          # /states/Alaska works
npm run build && npm run preview     # /states/Alaska is absent
```

`npm run build:strict` is the stricter gate — it fails the build on the empty datasets that
`build` merely warns about.

## Caveats

- All links assume an empty base path, which is correct for `dev`, `build` and `preview`.
  The GitHub Pages workflow patches `deployment.basePath` to `/<repo>` at deploy time; on a
  deployed build the markdown, `LinkButton` and `DataTable` links still work (they go through
  `addBasePath`), but the **map** link columns would need `/<repo>` prepended in SQL. That
  asymmetry is itself worth testing if you plan to deploy — set a base path locally and
  rerun this page.
- PointMap and BubbleMap fetch remote Leaflet tiles. Without network access the basemap is
  blank but the markers and their links still work.
- The centroids in test 10 are approximate, entered inline in the query for link-testing
  purposes only.
