import { createFileRoute } from '@tanstack/solid-router'
import { Navigation } from '../components/Navigation'

export const Route = createFileRoute('/tools')({
	component: ToolsPage,
})

function ToolsPage() {
	return (
		<>
			<Navigation />
			<h1>Tools</h1>
		</>
	)
}
