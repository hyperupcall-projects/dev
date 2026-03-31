import { createFileRoute } from '@tanstack/solid-router'
import { serveCatalogPath } from '../server/catalogs'

export const Route = createFileRoute('/catalogs')({
	server: {
		handlers: {
			GET: async () => serveCatalogPath(''),
		},
	},
})
