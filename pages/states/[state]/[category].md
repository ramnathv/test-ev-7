<!--
  NESTED TEMPLATED PAGE — two parameters in one route.
  Route: /states/<state>/<category>
  e.g. /states/New York/Sinister Toys

  No frontmatter at all here, so the dynamic H1 in the body is the only heading. This is
  the other valid pattern for a templated page title (the parent index.md uses a static
  frontmatter title + hide_title instead).
-->

# {params.category}

<small>

[← {params.state}](/states/{params.state}) · [All link tests](/link-tests)

</small>

<Alert status=info>

**Two-parameter round-trip check.**

- `params.state` → **{params.state}**
- `params.category` → **{params.category}**

Both values contain a space in most cases. Both should appear intact above.

</Alert>

```sql cat_summary
select
    count(*)             as orders,
    sum(sales)           as sales_usd,
    avg(sales)           as avg_order,
    count(distinct item) as items
from needful_things.orders
where state    = '${params.state}'
  and category = '${params.category}'
```

{#if cat_summary[0].orders === 0}

<Alert status=negative>

**No rows for `state = '{params.state}'` and `category = '{params.category}'`.**

Expected if either parameter is invalid, or if this state genuinely has no orders in this
category. Both are worth distinguishing when you see it — check the parent
[{params.state}](/states/{params.state}) page for which categories actually have data.

</Alert>

{:else}

<Grid cols=3>
    <BigValue data={cat_summary} value=sales_usd fmt=usd0 title="Sales" />
    <BigValue data={cat_summary} value=orders fmt=num0 title="Orders" />
    <BigValue data={cat_summary} value=avg_order fmt=usd2 title="Avg order" />
</Grid>

## Items

```sql cat_items
select
    item,
    count(*)   as orders,
    sum(sales) as sales_usd
from needful_things.orders
where state    = '${params.state}'
  and category = '${params.category}'
group by item
order by sales_usd desc
```

<DataTable data={cat_items} rows=all>
    <Column id=item title="Item" />
    <Column id=orders fmt=num0 />
    <Column id=sales_usd fmt=usd0 title="Sales" />
</DataTable>

<BarChart data={cat_items} x=item y=sales_usd yFmt=usd0 swapXY=true title="Sales by item" />

## Sibling categories in {params.state}

Links back out to the other nested pages under the same state — a templated page linking
to its own siblings, which is where a leading slash in a markdown link most often slips in
by accident.

```sql sibling_cats
select
    category,
    sum(sales) as sales_usd
from needful_things.orders
where state     = '${params.state}'
  and category != '${params.category}'
group by category
order by sales_usd desc
```

{#each sibling_cats as row}

- [{row.category}](/states/{params.state}/{row.category})

{/each}

{/if}
