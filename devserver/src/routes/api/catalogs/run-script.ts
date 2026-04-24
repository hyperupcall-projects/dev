import { createFileRoute } from '@tanstack/solid-router'
import { runCatalogScript } from '../../../server/catalog-scripts'
import type { ScriptId } from '../../../server/catalog-scripts'

export const Route = createFileRoute('/api/catalogs/run-script')({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as { script: ScriptId }
				return runCatalogScript(body.script)
			},
		},
	},
})
