import { createFileRoute } from '@tanstack/solid-router'
import { Navigation } from '../components/Navigation'

export const Route = createFileRoute('/lint')({
	component: LintPage,
})

function LintPage() {
	return (
		<>
			<Navigation />
			<div class="mx-1">
				<h1 class="title mb-0">Lint</h1>
				<p>Lint page is now served by TanStack Start.</p>
			</div>
		</>
	)
}
