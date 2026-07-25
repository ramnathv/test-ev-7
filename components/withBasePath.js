import { addBasePath } from '@evidence-dev/sdk/utils/svelte';

/**
 * Rewrite a link column through `addBasePath`.
 *
 * The map components navigate on click with `window.location = row[link]`, using the
 * column value raw — unlike `<DataTable>`, which routes clicks through `addBasePath`.
 * So a map link column has to arrive already carrying `deployment.basePath`. This does
 * that at render time, which is what keeps the base path out of the SQL.
 *
 * `addBasePath` here is the config-bound export, so it reads `deployment.basePath` from
 * `evidence.config.yaml` — nothing to hardcode, and nothing to change when the base path
 * does. It is also idempotent (it returns a path that already starts with the base path
 * untouched) and a no-op when the base path is empty, so applying it is always safe.
 *
 * @param {Iterable<Record<string, unknown>>|undefined} rows query result or plain array
 * @param {string|undefined} link name of the column holding the URL
 * @returns {Record<string, unknown>[]}
 */
export const withBasePath = (rows, link) => {
	const arr = rows ? Array.from(rows) : [];
	if (!link) return arr;
	return arr.map((row) => ({ ...row, [link]: addBasePath(row[link]) }));
};
