---
title: Links from a table
---

Every link on this page targets the templated pages under `pages/states/`. Click through
and confirm you land on a populated state page whose heading matches the row you clicked.

[← Back to the test index](/link-tests)

```sql state_sales
select
    state,
    count(*)               as orders,
    sum(sales)             as sales_usd,
    count(distinct item)   as items,
    '/states/' || state    as state_link
from needful_things.orders
where state != 'Alaska'   -- deliberately unlinked; see test 5
group by state
order by sales_usd desc
```

## Test 1 — `<DataTable link=…>`

The canonical pattern: build the URL as a column in SQL, hand the column name to `link`.
The whole row becomes clickable.

The link column holds a **root-absolute path with a leading slash** (`'/states/' || state`).
Every link on this site does, and that is not optional: `deployment.basePath` is empty here,
so nothing rewrites the href, and a relative value like `'states/' || state` would be
resolved by the browser against the *current directory* — clicking it from `/link-tests/`
lands on `/link-tests/states/California`. See the note under test 3.

<DataTable data={state_sales} link=state_link rows=15>
    <Column id=state title="State" />
    <Column id=orders fmt=num0 />
    <Column id=items fmt=num0 title="Items" />
    <Column id=sales_usd fmt=usd0 title="Sales" />
</DataTable>

**Check:** the row for *New York*, *West Virginia*, *New Hampshire*, *North Carolina*,
*Rhode Island*, *South Carolina*, *New Jersey*, *New Mexico* and *District of Columbia* —
multi-word names are where link building breaks. The destination heading must read the full
name.

## Test 2 — the link column shown in the open

Same query, with the generated URL as a visible column so you can eyeball the strings
without a click. Nothing here should contain a double slash, a trailing slash, `undefined`,
or a stray `%`.

<DataTable data={state_sales} rows=8>
    <Column id=state title="State" />
    <Column id=state_link title="Generated link" />
</DataTable>

## Test 3 — markdown links from an `{#each}` loop

The other way to generate templated pages: plain markdown links, built inside an `{#each}`
loop.

These also need the leading slash — `/states/{row.state}`, not `states/{row.state}`.
Evidence runs markdown hrefs through `addBasePath`, but that function is a **no-op when
`basePath` is empty**, which it is in this project. The raw href reaches the browser, and a
relative one compounds against the current directory. This is the single most common way to
get a `/link-tests/link-tests/…` style URL.

The leading slash is also safe once a base path *is* configured: `addBasePath` prepends the
base to a path that already starts with `/` (and skips paths that already carry it), so
there is no double-slash risk in either direction.

```sql top_states
select
    state,
    sum(sales) as sales_usd
from needful_things.orders
where state != 'Alaska'
group by state
order by sales_usd desc
limit 10
```

{#each top_states as row}

- [{row.state}](/states/{row.state}) — <Value data={row} column=sales_usd fmt=usd0 />

{/each}

## Test 4 — deep links straight into the nested template

Skipping the intermediate page and linking directly to `/states/<state>/<category>`. Both
URL segments come from data and both contain spaces, so this is the strictest encoding
case on the site.

```sql state_category_pairs
select
    state,
    category,
    sum(sales)                                    as sales_usd,
    '/states/' || state || '/' || category         as deep_link
from needful_things.orders
where state != 'Alaska'
group by all
order by sales_usd desc
limit 20
```

<DataTable data={state_category_pairs} link=deep_link rows=20>
    <Column id=state title="State" />
    <Column id=category title="Category" />
    <Column id=sales_usd fmt=usd0 title="Sales" />
    <Column id=deep_link title="Generated link" />
</DataTable>

## Test 5 — a state with data that is linked from nowhere

**Alaska** has orders in the source data but is filtered out of every query on this site,
so no link to it exists anywhere. This distinguishes the two ways Evidence discovers
templated pages:

- `npm run dev` builds routes on demand → typing the URL by hand works.
- `npm run build` prerenders only pages it found a link to → the built site has no Alaska
  page.

Try `/states/Alaska` by hand in dev, then again against `npm run build && npm run preview`.
The dev server should show a normal populated page; the built site should not have that
route. If you want Alaska in the static build, the fix is to link it — for example by
dropping the `where state != 'Alaska'` filter from test 1.

## Test 6 — an invalid parameter

These point at values that do not exist in the data. The template still renders — Evidence
does not 404 on an unknown parameter — and the page's own `{#if}` block should show the
"no rows matched" message rather than a crashed component.

- [states/Atlantis](/states/Atlantis) — no such state
- [states/California/Enchanted Groceries](/states/California/Enchanted%20Groceries) — real state, fake category
- [states/Puerto Rico](/states/Puerto%20Rico) — a real US jurisdiction with no rows in this dataset
- [states/vermont](/states/vermont) — real state, wrong case; the SQL filter is case-sensitive

Puerto Rico is the realistic one: all 51 states and DC have orders here, so a
plausible-looking value with no data has to come from outside that set.

The lowercase `vermont` link is worth watching in a **built** site specifically. It
prerenders to `build/states/vermont/`, and on a case-insensitive filesystem (macOS default,
Windows) that collides with `build/states/Vermont/` — one silently overwrites the other, so
the correctly-cased page ends up serving the empty state. Verified in this project: after
`npm run build`, `build/states/` contains a single `Vermont` directory holding the *no rows
matched* page. It reproduces on a case-sensitive filesystem only as a plain empty page, with
`/states/Vermont` unharmed. If you are generating slugs by lowercasing a display value, this
is the bug that finds you — and only in the built site, never in `dev`.

Sparse-but-valid data is worth a look too: [states/Wyoming](/states/Wyoming) has only 3
orders, so its charts and per-category breakdown are nearly empty without being an error.

## Test 7 — the same target reached three ways

Pick one state and reach it from the table above, from the `{#each}` list, and from the map
page. All three should land on the identical URL and render the identical page. If the map
route differs from the table route, the two link columns have drifted apart.

- [states/California](/states/California) — direct markdown link
- [The map version of the same test](/link-tests/from-map)
