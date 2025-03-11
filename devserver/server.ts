import express from 'express'
import { renderPage } from './webframework.ts'

import { Api as repositoriesApi } from './pages/projects.server.ts'
import { Api as servicesApi } from './pages/services.server.ts'
import { Api as repositoriesSettingsApi } from './pages/projects/settings.server.ts'

export function createApp() {
	const app = express()
	app.use(express.json())
	app.use((req, _res, next) => {
		console.info(req.method + ' ' + req.url)
		next()
	})
	app.get('/', renderPage)
	app.get('/lint', renderPage)

	app.get('/services', renderPage)
	servicesApi(app)

	app.get('/projects', renderPage)
	repositoriesApi(app)

	app.get('/projects/settings', renderPage)
	repositoriesSettingsApi(app)

	return app
}
