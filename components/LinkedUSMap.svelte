<script>
	// Drop-in replacement for <USMap> whose `link` column respects deployment.basePath.
	// Same props as USMap — everything not named below passes straight through.
	import { USMap, QueryLoad } from '@evidence-dev/core-components';
	import { withBasePath } from './withBasePath.js';

	export let data;
	export let link = undefined;
</script>

<QueryLoad {data} let:loaded>
	<USMap {...$$restProps} {link} data={withBasePath(loaded, link)} />
</QueryLoad>
