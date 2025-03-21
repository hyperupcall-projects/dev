import { Navigation } from '#components/Navigation.ts'
import { html } from 'htm/preact'
import type { PageSchemaT } from './lint.server.ts'

export function Page({ devCommand }: PageSchemaT) {
	return html`
		<div>
			<${Navigation} />
			<div class="mx-1">
				<pre>${devCommand}</pre>
			</div>
		</div>
	`
}
