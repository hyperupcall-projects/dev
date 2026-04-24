import { createFileRoute } from '@tanstack/solid-router'
import { serveUblacklistFile } from '../server/ublacklist'

export const Route = createFileRoute('/ublacklist-severity1.txt')({
	server: {
		handlers: {
			GET: () => serveUblacklistFile('ublacklist-severity1.txt'),
		},
	},
})
