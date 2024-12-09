import fs from 'node:fs/promises'
import path from 'node:path'
import render from 'preact-render-to-string'
import { h } from 'preact'
import express from 'express'
import { getServiceData } from './util.js'
import { rollup } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import dedent from 'dedent'

/**
 * @import { CommandStartServerOptions } from '../index.js'
 */

const ServerRoot = path.join(import.meta.dirname, '../dev-server')

export async function run(
	/** @type {CommandStartServerOptions} */ values,
	/** @type {string[]} */ positionals,
) {
	// TODO
	if (positionals.includes('--prebundle')) {
		let bundle
		try {
			bundle = await rollup({
				input: ['preact', 'htm'],
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

	const app = express()
	app.use(express.static('./dev-server/static'))

	app.get('/vendor/bulma.css', (req, res) => {
		res.sendFile('./static/vendor/bulma-v1.0.2/css/bulma.css', {
			root: ServerRoot,
		})
	})

	app.get('/hydrator', async (req, res) => {
		const id = req.query.id
		try {
			const text = await fs.readFile(`./dev-server/pages/${id}.js`, 'utf-8')
			res.setHeader('Content-Type', 'application/javascript')
			res.send(text)
		} catch (err) {
			res.status(404).send('Not Found')
		}
	})

	app.get('/', async (req, res) => {
		await renderPage(res, 'index')
	})

	app.get('/services', async (req, res) => {
		const serviceData = await getServiceData()
		await renderPage(res, 'services', { serviceData })
	})

	app.get('/api/services', async (req, res) => {
		const serviceData = await getServiceData()
		res.json(serviceData)
	})

	const port = 40008
	const server = app.listen(port, () => {
		console.log(`Listening on http://localhost:${port}`)
	})
	process.on('SIGINT', () => {
		server.close()
	})
}

async function renderPage(res, id, data) {
	let head
	let page
	try {
		const module = await import(`../dev-server/pages/${id}.js`)
		head = module.Head()
		page = render(h(module.Page))
	} catch (err) {
		if (err.code === 'ENOENT') {
			res.status(404).send('Not Found')
			return
		}
		throw err
	}

	res.setHeader('Content-Type', 'text/html')
	res.send(
		dedent(`<!doctype html>
							<html>
								<head>
									<meta charset="UTF-8" />
									<meta name="viewport" content="width=device-width, initial-scale=1.0" />
									<title>Example App</title>
									<link rel="stylesheet" href="/vendor/bulma.css" />
									<link rel="stylesheet" href="/css/global.css" />
								</head>
								${head}
								<!-- TODO: Use /static/bundled. htm and preact should not be tersed -->
								<script type="importmap">
								{
									"imports": {
										"preact": "https://esm.sh/preact@10.25.1",
										"preact/hooks": "https://esm.sh/preact@10.25.1/hooks",
										"htm/preact": "https://esm.sh/htm@3.1.1/preact?external=preact",
										"../static/isomorphic/components.js": "/isomorphic/components.js"
									}
								}
								</script>
								<script type="module" src="/hydrator?id=${id}"></script>
								<script type="module">
									import { h, hydrate, render } from 'preact'
									import { Page } from '/hydrator?id=${id}'
									hydrate(h(Page), document.getElementById('root'))
								</script>
								<body>
									<div id="root">
										${page}
									</div>
								</body>
							</html>`),
	)
}
