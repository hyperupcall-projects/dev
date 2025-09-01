import express from 'express'
import { renderPage } from './webframework/webframework.ts'
import type { Express } from 'express'
import { WebSocketServer } from 'ws'

import { Api as servicesApi } from '#pages/services.server.ts'
import { Api as dictionaryWatcherApi } from '#pages/tools/dictionary-watcher.server.ts'
import path from 'node:path'
import os from 'node:os'

await import('#utilities/db.ts')

export function createApp(app: Express, wss: WebSocketServer) {
	app.use(express.json())
	app.use((req, _res, next) => {
		console.info(req.method + ' ' + req.url)
		next()
	})
	app.get('/', renderPage)
	app.get('/ublacklist', (req, res) => {
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
		res.setHeader('Pragma', 'no-cache')
		res.setHeader('Expires', '0')
		res.setHeader('Surrogate-Control', 'no-store')

		res.sendFile(path.join(os.homedir(), '.dotfiles/config/ublacklist.txt'), {
			dotfiles: 'allow',
		})
	})
	app.get('/lint', renderPage)

	app.get('/services', renderPage)
	servicesApi(app)

	app.get('/tools', renderPage)

	app.get('/tools/dictionary-watcher', renderPage)
	dictionaryWatcherApi(app, wss)
}
