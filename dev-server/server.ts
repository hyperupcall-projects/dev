import fs from 'node:fs/promises'
import path from 'node:path'
import render from 'preact-render-to-string'
import { h } from 'preact'
import express from 'express'
import { getServiceData } from '../utilities/util.ts'
import tsBlankSpace from 'ts-blank-space'

import dedent from 'dedent'
import {
	getCachedRepositoryConfig,
	getRepositoryConfig,
	getRepositoryData,
} from '#utilities/repositories.ts'
import { execa } from 'execa'

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
	app.use(express.json())
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
			let module = await import(`./pages/${pageId}.ts`)
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
	app.post('/api/repositories/refresh', async (req, res) => {
		const cachePath = path.join(import.meta.dirname, 'static/repositories.json') // TODO
		const cachePath2 = path.join(import.meta.dirname, 'static/repositories2.json') // TODO
		const [json, json2] = await Promise.all([getRepositoryConfig(), getRepositoryData()])
		await fs.mkdir(path.dirname(cachePath), { recursive: true })
		await fs.mkdir(path.dirname(cachePath2), { recursive: true })
		await fs.writeFile(cachePath, JSON.stringify(json, null, '\t'))
		await fs.writeFile(cachePath2, JSON.stringify(json, null, '\t'))
		res.json({ success: true })
	})
	app.post('/api/repositories/open', async (req, res) => {
		const { owner, name } = req.body
		const json = await getCachedRepositoryConfig()
		await execa('zed', ['--new', path.join(json.cloneDir, owner, name)], {
			stdio: 'inherit',
		})
		res.send(200)
	})
	app.post('/api/repositories/clone', async (req, res) => {
		const { owner, name } = req.body
		const json = await getCachedRepositoryConfig()
		await fs.mkdir(path.join(json.cloneDir, owner), { recursive: true })
		await execa('git', ['clone', path.join(json.cloneDir, owner, name)], {
			stdio: 'inherit',
		})
	})

	return app
}

async function serveJs(req, res, relPath) {
	const pageId = req.url.slice(1)
	const file = `${relPath}/${pageId}`.replace(/\.js$/, '.ts')
	try {
		let text = await fs.readFile(file, 'utf-8')
		text = tsBlankSpace(text)
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
	const module = await import(`../dev-server/pages/${id}.ts`)
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
