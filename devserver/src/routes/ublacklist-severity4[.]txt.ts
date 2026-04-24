import { createFileRoute } from '@tanstack/solid-router'
import { serveUblacklistFile } from '../server/ublacklist'

export const Route = createFileRoute('/ublacklist-severity4.txt')({
	server: {
		handlers: {
			GET: () => serveUblacklistFile('ublacklist-severity4.txt'),
		},
	},
})
