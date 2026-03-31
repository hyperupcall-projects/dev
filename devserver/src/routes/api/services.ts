import { createFileRoute } from '@tanstack/solid-router'
import { getServiceData } from '#utilities/util.ts'

export const Route = createFileRoute('/api/services')({
	server: {
		handlers: {
			GET: async () => {
				const serviceData = await getServiceData()
				return Response.json(serviceData)
			},
		},
	},
})
