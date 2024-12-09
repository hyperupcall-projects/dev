import { h } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import { html } from 'htm/preact'
import { Nav } from '../static/isomorphic/components.js'

function Counter() {
	const [value, setValue] = useState(0)
	const increment = useCallback(() => {
		setValue(value + 1)
	}, [value])

	return html`<div>
		<p>Counter: ${value}</p>
		<button class="button" onClick=${increment}>Increment</button>
	</div>`
}

export function Head() {
	return `<link rel="stylesheet" href="/vendor/bulma.css" />`
}

export function Page() {
	return html`
		<div>
			<${Nav} />
			<div class="mx-1">
				<h1 class="title mb-0">Global Dev Server</h1>
				<p>My one-stop-shop for managing my computer and projects on my computer.</p>
				<hr />
				<${Counter} />
			</div>
		</div>
	`
}
