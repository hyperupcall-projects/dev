import fs from 'node:fs/promises'
import path from 'node:path'
import render from 'preact-render-to-string'
import { h } from 'preact'
import express from 'express'
import module from 'module'
import { getServiceData } from '../src/util.js'

import dedent from 'dedent'

const ServerRoot = path.join(import.meta.dirname, '../dev-server')
const importMap = {
	imports: {
		preact: 'https://esm.sh/preact@10.25.1',
		'preact/hooks': 'https://esm.sh/preact@10.25.1/hooks',
		'htm/preact': 'https://esm.sh/htm@3.1.1/preact?external=preact',
		'../static/isomorphic/components.js': '/isomorphic/components.js',
	},
}

export function bundledDependencies() {
	return ['preact', 'htm']
}

export async function createApp() {
	const app = express()
	app.use(express.static('./dev-server/static'))

	app.get('/vendor/bulma.css', (req, res) => {
		res.sendFile('./static/vendor/bulma-v1.0.2/css/bulma.css', {
			root: ServerRoot,
		})
	})
	app.get('/stub.js', (req, res) => {
		res.setHeader('Content-Type', 'application/javascript')
		res.send(``)
	})
	app.get('/pages/:page', async (req, res) => {
		const pageId = req.params.page
		try {
			let text = await fs.readFile(`./dev-server/pages/${pageId}.js`, 'utf-8')
			text = text.replaceAll(
				/(?:^|\n)import.*?from[ \t]*['"](.*?)['"]/g,
				(match, importId) => {
					if (importId in importMap.imports) {
						return match
					} else if (!importId.startsWith('.')) {
						return ''
					}
					return match
				},
			)
			res.setHeader('Content-Type', 'application/javascript')
			res.send(text)
		} catch (err) {
			console.info(err)
			if (err.code === 'ENOENT') {
				res.status(404).send('Not Found')
			} else {
				res.status(500)
			}
		}
	})
	app.post('/pages/:page', async (req, res) => {
		const pageId = req.params.page
		const body = req.body
		try {
			let module = await import(`./pages/${pageId}.js`)
			const result = (await module?.Server?.(body)) ?? {}
			res.setHeader('Content-Type', 'application/json')
			res.send(result)
		} catch (err) {
			console.info(err)
			if (err.code === 'ENOENT') {
				res.status(404).send('Not Found')
			} else {
				res.status(500)
			}
		}
	})

	app.get('/', async (req, res) => {
		await renderPage(res, 'index')
	})

	app.get('/services', async (req, res) => {
		const serviceData = await getServiceData()
		await renderPage(res, 'services', { serviceData })
	})

	app.get('/lint', async (req, res) => {
		await renderPage(res, 'lint', {})
	})

	app.get('/repositories', async (req, res) => {
		await renderPage(res, 'repositories', {})
	})

	app.get('/api/services', async (req, res) => {
		const serviceData = await getServiceData()
		res.json(serviceData)
	})

	return app
}

async function renderPage(res, id, data) {
	let head
	let page
	try {
		const module = await import(`../dev-server/pages/${id}.js`)
		head = module?.Head?.() ?? ''
		const result = (await module?.Server?.()) ?? {}
		page = render(h(() => module.Page(result)))
	} catch (err) {
		console.info(err)
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
								<script type="importmap">
								${JSON.stringify(importMap, null, '\t')}
								</script>
								<script type="module">
									import { h, hydrate, render } from 'preact'
									import { Page } from '/pages/${id}'
									fetch('/pages/${id}', {
										method: 'POST',
										headers: {
											'Content-Type': 'application/json',
										},
									})
										.then((res) => res.json())
										.then((data) => {
										console.log('data', data)
											hydrate(h(() => Page(data)), document.getElementById('root'))
									})
								</script>
								<body>
									<div id="root">
										${page}
									</div>
								</body>
							</html>`),
	)
}
