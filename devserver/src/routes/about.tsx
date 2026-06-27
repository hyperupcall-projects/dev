import { createFileRoute } from '@tanstack/solid-router'
import { Navigation } from '../components/Navigation'

export const Route = createFileRoute('/about')({
	component: AboutPage,
})

function AboutPage() {
	return (
		<>
			<Navigation />
			<div style="border-inline: 1px solid lightgray; padding: 1rem;">
				<p>
					Favicon by{' '}
					<a href="https://home.streamlinehq.com" target='_blank'>
						streamline
					</a>{' '}
					licensed under{' '}
					<a href="https://creativecommons.org/licenses/by/4.0/" target='_blank'>
						CC-BY-4.0
					</a>
					.
				</p>
			</div>
		</>
	)
}
