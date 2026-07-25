---
title: Links from a map
---

Click a state, a point, or a bubble. Each should navigate to the same templated pages the
[table page](/link-tests/from-table) links to.

Map link columns hold root-absolute paths with a leading slash, same as everywhere else on
this site. Maps differ from `<DataTable link=…>` in one way that only shows up under a base
path: a map click navigates with the column value **raw** (`window.location = link`), with
no `addBasePath` call, whereas DataTable routes its clicks through `addBasePath`. With
`deployment.basePath` empty the two are indistinguishable — which is exactly why the
difference is easy to ship without noticing.

This page shows both sides of that. Test 1 uses `<LinkedUSMap>` from `components/`, which
applies `addBasePath` itself and so works under any base path with **nothing hardcoded in
SQL**. Test 2 uses the raw built-in `<USMap>` and is the live reproduction of the bug —
under a base path its clicks 404 while the identical map above it works.

Test 3 stays on the raw built-ins. The same wrapper trick does **not** work for the Leaflet
maps: `Points.svelte` consumes `data` as a store (`$data`, `data.fetch()`, `data.length`),
so handing it a transformed plain array fails the prerender outright. Those two need either
the base path in SQL or a fix upstream.

[← Back to the test index](/link-tests)

```sql state_map
select
    state,
    sum(sales)             as sales_usd,
    count(*)               as orders,
    '/states/' || state    as state_link
from needful_things.orders
where state != 'Alaska'   -- deliberately unlinked, matching the table page
group by state
```

## Test 1 — `<LinkedUSMap link=…>` (base-path safe)

The main map link test: a choropleth of all 50 states plus DC, each clickable through to its
templated page. Uses the local wrapper, so the link column stays a plain `/states/…` path
and the base path is applied at render time.

<LinkedUSMap
    data={state_map}
    state=state
    value=sales_usd
    link=state_link
    fmt=usd0
    legend=true
    title="Sales by state"
    subtitle="Click any state to open its templated page"
/>

**Check:** click a narrow multi-word state — *New Jersey*, *Rhode Island*, *New Hampshire*,
*West Virginia* — and confirm the destination heading matches. *District of Columbia* is the
hardest target on the map; zoom the browser if you cannot hit it, or use the table page
instead.

## Test 2 — deep links, using the RAW built-in `<USMap>`

Same map geometry, but the link column targets `/states/<state>/<category>` for one fixed
category. Every destination URL has a space in its final segment.

This one deliberately uses the **unwrapped** `<USMap>`. With `deployment.basePath` empty it
behaves identically to test 1. Set a base path and it diverges: the page still prerenders
correct hrefs (the build-time crawl applies `addBasePath`) but clicking navigates to the raw
column value and 404s. Prerender and click disagree inside one component — that is the bug.

```sql state_map_deep
select
    state,
    sum(sales)                                as sales_usd,
    '/states/' || state || '/Odd Equipment'   as deep_link
from needful_things.orders
where category = 'Odd Equipment'
  and state != 'Alaska'
group by state
```

<USMap
    data={state_map_deep}
    state=state
    value=sales_usd
    link=deep_link
    fmt=usd0
    colorScale=positive
    legend=true
    title="Odd Equipment sales by state"
    subtitle="Click any state to jump straight to its Odd Equipment page"
/>

## Test 3 — `<PointMap link=…>` and `<BubbleMap link=…>`

The other two linkable map types. Both need coordinates, which the orders table does not
carry, so the query below joins in a small set of **approximate** state centroids for a
dozen states. They are accurate enough to land the marker in the right state and no more —
this is a link test, not a geography exercise.

These maps render Leaflet tiles from a remote basemap, so they need network access. A grey
canvas with working markers means the tiles failed but the link test is still valid.

```sql state_points
with centroids as (
    select * from (values
        ('California',      36.78, -119.42),
        ('Texas',           31.00, -100.00),
        ('New York',        42.95,  -75.50),
        ('Florida',         28.60,  -82.40),
        ('Illinois',        40.00,  -89.20),
        ('Pennsylvania',    40.90,  -77.80),
        ('Ohio',            40.30,  -82.80),
        ('Georgia',         32.65,  -83.40),
        ('North Carolina',  35.50,  -79.40),
        ('Michigan',        44.35,  -85.40),
        ('Washington',      47.40, -120.50),
        ('Arizona',         34.30, -111.70)
    ) as t(state, latitude, longitude)
)
select
    c.state,
    c.latitude,
    c.longitude,
    sum(o.sales)              as sales_usd,
    count(*)                  as orders,
    '/states/' || c.state     as state_link
from centroids c
join needful_things.orders o on o.state = c.state
group by c.state, c.latitude, c.longitude
order by sales_usd desc
```

### PointMap

<PointMap
    data={state_points}
    lat=latitude
    long=longitude
    pointName=state
    value=sales_usd
    valueFmt=usd0
    link=state_link
    height=340
    title="Sales at approximate state centroids"
/>

### BubbleMap

Bubble size carries order count, colour carries sales, and the link is the same as above —
so a large pale bubble and a small dark one should still both navigate correctly.

<BubbleMap
    data={state_points}
    lat=latitude
    long=longitude
    size=orders
    sizeFmt=num0
    value=sales_usd
    valueFmt=usd0
    pointName=state
    link=state_link
    height=340
    title="Orders (size) and sales (colour) by state"
/>

## Test 4 — a map with no link prop

The control case. This map is identical to test 1 with `link` removed: hovering should show
a tooltip and clicking should do nothing at all. If clicking this map navigates anywhere,
something is leaking link behaviour between map instances on the same page.

<USMap
    data={state_map}
    state=state
    value=orders
    fmt=num0
    colorScale=info
    title="Order count by state (not clickable)"
/>
