import { createFileRoute } from '@tanstack/solid-router'
import { serveUblacklistFile } from '../server/ublacklist'

export const Route = createFileRoute('/ublacklist.txt')({
	server: {
		handlers: {
			GET: () => serveUblacklistFile('ublacklist.txt'),
		},
	},
})
