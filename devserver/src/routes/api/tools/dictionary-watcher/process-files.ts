import { createFileRoute } from '@tanstack/solid-router'
import { processDictionaryFiles } from '../../../../server/dictionary-watcher'

export const Route = createFileRoute('/api/tools/dictionary-watcher/process-files')({
	server: {
		handlers: {
			POST: async () => {
				return Response.json(await processDictionaryFiles())
			},
		},
	},
})
