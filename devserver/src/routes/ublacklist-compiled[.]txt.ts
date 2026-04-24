import { createFileRoute } from '@tanstack/solid-router'
import { serveUblacklistFile } from '../server/ublacklist'

export const Route = createFileRoute('/ublacklist-compiled.txt')({
	server: {
		handlers: {
			GET: () => serveUblacklistFile('ublacklist-compiled.txt'),
		},
	},
})
