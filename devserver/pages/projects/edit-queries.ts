import { Navigation } from '#components/Navigation.ts'
import { html } from 'htm/preact'
import { Fragment } from 'preact'

export function Page() {
	return html`<${Fragment}>
		<${Navigation} />
		<h1>Edit Queries</h1>
	<//>`
}
