import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'

/**
 * @import { CommandStartServerOptions } from '../index.js'
 */

const ServerRoot = path.join(import.meta.dirname, '../dev-server')

export async function run(
	/** @type {CommandStartServerOptions} */ values,
	/** @type {string[]} */ positionals,
) {
	const app = express()
	app.set('views', path.join(ServerRoot, './pages'))
	app.set('view engine', 'squirrelly')

	app.use('/public', express.static('./static'))

	app.get('/vendor/bulma.css', async (req, res) => {
		res.sendFile(path.join(ServerRoot, './vendor/bulma-v1.0.2/css/bulma.css'))
		res.status(200)
	})

	app.get('/', (req, res) => {
		res.render('index', { title: 'hello2' })
	})

	const port = 40008
	app.listen(port, () => {
		console.log(`Listening on http://localhost:${port}`)
	})
}
