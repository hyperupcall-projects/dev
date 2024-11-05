import express from 'express'

/**
 * @import { CommandStartServerOptions } from '../index.js'
 */

export async function run(
	/** @type {CommandStartServerOptions} */ values,
	/** @type {string[]} */ positionals,
) {
	const app = express()
	app.get('/', (req, res) => {
		res.send('Hello, World')
	})

	const port = 40008
	app.listen(port, () => {
		console.log(`App listening on http://localhost:${port}`)
	})
}
