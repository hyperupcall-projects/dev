import { html } from 'htm/preact'
import { Nav } from '../static/isomorphic/components.js'

export function Head() {
	return ''
}

if (!globalThis.process) globalThis.process = 0
export function Page() {
	function getServices() {
		if (typeof globalThis.process === 'object') {
		} else {
			return fetch('/api/services')
				.then((res) => res.json())
				.then((data) => {
					console.log(data)
				})
		}
	}
	getServices()

	return html`<div>
		<${Nav} />
		<div class="mx-1">
			<h1 class="title mb-0">Services</h1>
			<p class="mb-2">My user services managed by systemd.</p>
			<hr class="mb-1" />
			<table class="table">
				<thead></thead>
			</table>
		</div>
	</div>`
}
