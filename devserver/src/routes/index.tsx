import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { getServiceData } from '#utilities/util.ts'
import { Navigation } from '../components/Navigation'

const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
	const services = await getServiceData()
	return { services }
})

export const Route = createFileRoute('/')({
	component: HomePage,
	loader: () => getHomeData(),
})

function HomePage() {
	const data = Route.useLoaderData()

	return (
		<>
			<Navigation />
			<div style="border-inline: 1px solid lightgray">
				<div style="display: grid; grid-template-columns: 1fr 1fr">
					<div class="p-1" style="background-color: antiquewhite; border-inline-end: 1px solid lightgray">
						<h1 class="title mb-0">Services</h1>
						<div class="content">
							<ul class="index-ul" style="margin-inline-start: 18px;">
								{data().services.map((service) => (
									<li>
										<a
											class="hover-bold"
											style={service.isActive ? 'color: lightgreen' : 'color: red'}
											href={`/services#${service.name}`}
										>
											{service.name}
										</a>
									</li>
								))}
							</ul>
						</div>
					</div>
					<div class="p-1" style="background-color: aliceblue">
						<h1 class="title mb-0">Recent Projects</h1>
					</div>
				</div>
			</div>
		</>
	)
}
