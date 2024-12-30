import fs from 'node:fs/promises'
import path from 'node:path'
import render from 'preact-render-to-string'
import { h } from 'preact'
import express from 'express'
import { getServiceData } from '../src/util.js'

import dedent from 'dedent'
import { rm } from 'node:fs'

const importMap = {
	imports: {
		preact: 'https://esm.sh/preact@10.25.1',
		'preact/hooks': 'https://esm.sh/preact@10.25.1/hooks',
		'htm/preact': 'https://esm.sh/htm@3.1.1/preact?external=preact',
		'@preact/signals': '/bundled/signals.js',
		'#components/': '/components/',
		'#utilities/': '/utilities/',
	},
}

export function bundledDependencies() {
	return ['preact', 'htm']
}

export async function createApp() {
	const app = express()
	app.use((req, res, next) => {
		console.info(req.method + ' ' + req.url)
		next()
	})

	app.get('/components/*path', (req, res) => serveJs(req, res, './dev-server'))
	app.get('/pages/*path', (req, res) => serveJs(req, res, './dev-server'))
	app.post('/pages/:page', async (req, res) => {
		const pageId = req.params.page
		const body = req.body
		try {
			let module = await import(`./pages/${pageId}.js`)
			const result = (await module?.Server?.(body)) ?? {}
			res.setHeader('Content-Type', 'application/json')
			res.send(result)
		} catch (err) {
			console.error(err)
			if (err.code === 'ENOENT') {
				res.status(404).send('Not Found')
			} else {
				res.status(500)
			}
		}
	})
	app.use(express.static('./dev-server/static'))
	app.get('/utilities/*path', (req, res) => serveJs(req, res, '.'))

	app.get('/', renderPage)
	app.get('/lint', renderPage)
	app.get('/repositories', renderPage)
	app.get('/services', renderPage)

	app.get('/api/services', async (req, res) => {
		const serviceData = await getServiceData()
		res.json(serviceData)
	})

	return app
}

async function serveJs(req, res, relPath) {
	const pageId = req.url.slice(1)
	const file = `${relPath}/${pageId}`
	try {
		let text = await fs.readFile(file, 'utf-8')
		text = stripImports(text)
		res.setHeader('Content-Type', 'application/javascript')
		res.send(text)
	} catch (err) {
		if (err.code === 'ENOENT') {
			return res.status(404).send({
				error: 'Not Found',
				message: `File not found: "${file}"`,
			})
		}
		throw err
	}
}

async function renderPage(req, res) {
	let id = req.url.slice(1)
	if (id === '') id = 'index'

	let head
	let page
	// try {
	const module = await import(`../dev-server/pages/${id}.js`)
	head = module?.Head?.() ?? ''
	const result = (await module?.Server?.()) ?? {}
	page = render(h(() => module.Page(result)))

	res.setHeader('Content-Type', 'text/html')
	res.send(
		dedent(`<!doctype html>
							<html>
								<head>
									<meta charset="UTF-8" />
									<meta name="viewport" content="width=device-width, initial-scale=1.0" />
									<title>Example App</title>
									<link rel="stylesheet" href="/vendor/bulma-v1.0.2/css/bulma.css" />
									<link rel="stylesheet" href="/css/global.css" />
								</head>
								${head}
								<script type="importmap">
								${JSON.stringify(importMap, null, '\t')}
								</script>
								<script type="module">
									import { h, hydrate, render } from 'preact'
									import { Page } from '/pages/${id}.js'
									fetch('/pages/${id}', {
										method: 'POST',
										headers: {
											'Content-Type': 'application/json',
										},
									})
										.then((res) => res.json())
										.then((data) => {
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

function stripImports(text) {
	return text.replaceAll(
		/(?:^|\n)import.*?from[ \t]*['"](.*?)['"]/g,
		(match, importId) => {
			if (importId in importMap.imports) {
				return match
			} else if (!importId.startsWith('.') && !importId.startsWith('#')) {
				return '\n'
			} else if (importId === '#common') {
				return '\n'
			} else {
				return match
			}
		},
	)
}
