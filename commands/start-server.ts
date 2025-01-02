import watcher from '@parcel/watcher'
import { Server } from 'http'
import debounce from 'debounce'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'

import type { CommandStartServerOptions } from '../index.ts'

export async function run(values: CommandStartServerOptions, positionals: string[]) {
	const { createApp } = await import('../dev-server/server.ts')
	const app = await createApp()

	/** @type {Server} */
	let server
	process.on('SIGINT', () => {
		if (server) {
			server.close(() => {
				process.exit(0)
			})
		}
	})

	function createServer() {
		if (server) {
			server.close()
		}

		const port = Number(process.env.PORT) || 40008
		server = app.listen(port, () => {
			console.log(`Listening on http://localhost:${port}`)
		})
	}
	createServer()

	// watcher.subscribe(
	// 	'./dev-server',
	// 	(err, events) => {
	// 		if (err) return console.error(err)

	// 		for (const event of events) {
	// 			if (event.path.includes('/server.ts')) {
	// 				console.info('Rollup bundling...')
	// 				prebundle(positionals)
	// 			}
	// 		}

	// 		if (events.length > 0) {
	// 			debounce(createServer, 250)
	// 		}
	// 	},
	// 	{},
	// )
}

async function prebundle(positionals: string[]) {
	if (true || positionals.includes('--prebundle')) {
		// TODO
		let bundle
		try {
			bundle = await rollup({
				input: ['preact', 'htm', '@preact/signals'],
				plugins: [nodeResolve()],
			})
			await bundle.write({
				dir: './dev-server/static/bundled',
				format: 'es',
			})
		} catch (error) {
			console.error(error)
			process.exit(1)
		}
		if (bundle) {
			await bundle.close()
		}
		process.exit(0)
	}
}
