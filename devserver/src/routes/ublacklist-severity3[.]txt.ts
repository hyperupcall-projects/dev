import { createFileRoute } from '@tanstack/solid-router'
import { serveUblacklistFile } from '../server/ublacklist'

export const Route = createFileRoute('/ublacklist-severity3.txt')({
	server: {
		handlers: {
			GET: () => serveUblacklistFile('ublacklist-severity3.txt'),
		},
	},
})
