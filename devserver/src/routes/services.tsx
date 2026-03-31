import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { getServiceData } from '#utilities/util.ts'
import { Navigation } from '../components/Navigation'

const getServicesData = createServerFn({ method: 'GET' }).handler(async () => {
	return { services: await getServiceData() }
})

export const Route = createFileRoute('/services')({
	component: ServicesPage,
	loader: () => getServicesData(),
})

function ServicesPage() {
	const data = Route.useLoaderData()

	return (
		<div>
			<Navigation />
			<div class="mx-1">
				<h1 class="title mb-0">Services</h1>
				<p class="mb-0">Tools to manage my user-level systemd services.</p>
				<hr class="mt-1" />
				<div class="service-list">
					{data().services.map((service) => (
						<div class="service">
							<span
								class="is-size-4"
								style={service.isActive ? 'border: 1px solid green' : 'border: 1px solid red'}
							>
								{service.name}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
