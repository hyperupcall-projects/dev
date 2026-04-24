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
			<div style="border-inline: 1px solid lightgray; font-size: 24px;">
				<p>You can do it!</p>
				<p>Your priorities!</p>
				<ol>
					<li>- Being mindful</li>
					<li>- Getting sleep (going to bed by midnight LATEST)</li>
					<li>- School</li>
				</ol>
			</div>
		</>
	)
}
