import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { Nav } from '#components/Nav.js'

export function Page() {
	const [services, setServices] = useState([])

	function getServices() {
		if (typeof window === 'object') {
			return fetch('/api/services')
				.then((res) => res.json())
				.then((data) => {
					setServices(data)
				})
		} else {
		}
	}
	getServices()

	return html`<div>
		<${Nav} />
		<div class="mx-1">
			<h1 class="title mb-0">Services</h1>
			<p class="mb-0">Tools to manage my user-level systemd services.</p>
			<hr class="mt-1" />
			<div class="service-list">
				${services.map((service) => {
					return html`<div class="service">
						<span
							class="is-size-4"
							style="${service.isActive
								? 'border: 1px solid green'
								: 'border: 1px solid red'}"
							>${service.name}</span
						>
					</div>`
				})}
			</div>
		</div>
	</div>`
}
