import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import { engine } from 'express-handlebars' // TODO
import { getServiceData } from './util.js'

/**
 * @import { CommandStartServerOptions } from '../index.js'
 */

const ServerRoot = path.join(import.meta.dirname, '../dev-server')

export async function run(
	/** @type {CommandStartServerOptions} */ values,
	/** @type {string[]} */ positionals,
) {
	const app = express()

	app.engine('.hbs', engine({ extname: '.hbs' }))
	app.set('view engine', '.hbs')
	app.set('views', path.join(ServerRoot, './pages'))

	app.use('/public', express.static('./static'))

	app.get('/vendor/bulma.css', async (req, res) => {
		res.sendFile('./vendor/bulma-v1.0.2/css/bulma.css', {
			root: ServerRoot,
		})
		res.status(200)
	})

	app.get('/', (req, res) => {
		res.render('index', { title: 'hello2' })
	})

	app.get('/services', async (req, res) => {
		const serviceData = await getServiceData()
		res.render('services', { serviceData })
	})

	const port = 40008
	const server = app.listen(port, () => {
		console.log(`Listening on http://localhost:${port}`)
	})
	process.on('SIGINT', () => {
		server.close()
	})
}
