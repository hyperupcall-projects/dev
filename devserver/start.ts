import { Server } from 'node:http'
import debounce from 'debounce'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'

import type { CommandStartServerOptions } from '../index.js'

export async function startServer() {
	const { createApp } = await import('./server.ts')
	const app = await createApp()
	let server: Server | null = null
	function createServer() {
		if (server) {
			server.close()
		}
		const port = Number(process.env.PORT) || 3000
		server = app.listen(port)
		server.on('error', (err) => {
			console.error(err)
			process.exit(1)
		})
		server.on('listening', () => {
			console.log(`Listening on http://localhost:${port}`)
		})
	}
	createServer()
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
				dir: './devserver/static/bundled',
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
