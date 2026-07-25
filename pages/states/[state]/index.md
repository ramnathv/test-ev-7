---
title: State detail
hide_title: true
---

<!--
  TEMPLATED PAGE — target of the table and map links.
  Route: /states/<state>   e.g. /states/California, /states/New York

  Note: the frontmatter `title` is deliberately STATIC. Frontmatter is plain YAML and
  does not interpolate, so `title: "{params.state}"` would render the literal text
  "{params.state}" in the tab and breadcrumb. The dynamic heading lives in the body
  below, with hide_title suppressing the static one.
-->

# {params.state}

<small>

[← All link tests](/link-tests) · [From a table](/link-tests/from-table) · [From a map](/link-tests/from-map)

</small>

<Alert status=info>

**Param round-trip check.** `params.state` resolved to: **{params.state}**

If you arrived here by clicking a state whose name contains a space (New York, West
Virginia, District of Columbia), that value should appear above *with the space intact* —
not as `New%20York` and not truncated at the space. That is the main thing this page is
here to prove.

</Alert>

```sql state_summary
select
    count(*)                     as orders,
    sum(sales)                   as sales_usd,
    count(distinct item)         as items,
    count(distinct category)     as categories,
    max(order_datetime)          as last_order
from needful_things.orders
where state = '${params.state}'
```

{#if state_summary[0].orders === 0}

<Alert status=negative>

**No rows matched `state = '{params.state}'`.**

This is the expected result for an invalid parameter. Evidence renders the template for
*any* value in the URL slot — it does not 404 on unknown parameters — so a templated page
should always handle the empty case explicitly, as this page does with an `{#if}` block.

If you reached this from a real link on the table or map page, something is wrong with the
link column or with parameter decoding.

</Alert>

[← Back to the link tests](/link-tests)

{:else}

<Grid cols=4>
    <BigValue data={state_summary} value=sales_usd fmt=usd0 title="Sales" />
    <BigValue data={state_summary} value=orders fmt=num0 title="Orders" />
    <BigValue data={state_summary} value=items fmt=num0 title="Distinct items" />
    <BigValue data={state_summary} value=categories fmt=num0 title="Categories" />
</Grid>

## Drill one level deeper

Both controls below link into the **nested** templated page
`pages/states/[state]/[category].md` — two parameters in one route. Every category name
contains a space, so these links exercise encoding in the *final* URL segment.

```sql state_categories
select
    category,
    count(*)   as orders,
    sum(sales) as sales_usd,
    '/states/${params.state}/' || category as category_link
from needful_things.orders
where state = '${params.state}'
group by category
order by sales_usd desc
```

<DataTable data={state_categories} link=category_link rows=all>
    <Column id=category title="Category" />
    <Column id=orders fmt=num0 />
    <Column id=sales_usd fmt=usd0 title="Sales" />
</DataTable>

The same targets as plain markdown links built in an `{#each}` loop. Note the leading slash:
these are root-absolute, exactly like the `link` column above. A relative href here would
resolve against `/states/{params.state}/` and produce `/states/{params.state}/states/…`:

{#each state_categories as row}

- [{params.state} → {row.category}](/states/{params.state}/{row.category})

{/each}

## Sales over time

```sql state_monthly
select
    date_trunc('month', order_datetime) as month,
    category,
    sum(sales)                          as sales_usd
from needful_things.orders
where state = '${params.state}'
group by all
order by month
```

<LineChart data={state_monthly} x=month y=sales_usd series=category yFmt=usd0 title="Monthly sales by category" />

## Channel mix

```sql state_channels
select
    channel_group,
    channel,
    sum(sales) as sales_usd
from needful_things.orders
where state = '${params.state}'
group by all
order by sales_usd desc
```

<DataTable data={state_channels} rows=all>
    <Column id=channel_group title="Channel group" />
    <Column id=channel title="Channel" />
    <Column id=sales_usd fmt=usd0 title="Sales" contentType=colorscale />
</DataTable>

{/if}
