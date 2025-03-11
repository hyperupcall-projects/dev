import { Navigation } from '#components/Navigation.ts'
import { html } from 'htm/preact'

export function Page({ devCommand }) {
	return html`
		<div>
			<${Navigation} />
			<div class="mx-1">
				<pre>${devCommand}</pre>
			</div>
		</div>
	`
}
