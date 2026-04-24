import { createFileRoute } from '@tanstack/solid-router'
import { serveUblacklistFile } from '../server/ublacklist'

export const Route = createFileRoute('/ublockorigin-compiled.txt')({
	server: {
		handlers: {
			GET: () => serveUblacklistFile('ublockorigin-compiled.txt'),
		},
	},
})
