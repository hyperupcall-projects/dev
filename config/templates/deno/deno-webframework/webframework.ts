import fs from 'node:fs/promises'
import render from 'preact-render-to-string'
import { h } from 'preact'
import express from 'express'
import type { Request, Response } from 'express'
import dedent from 'dedent'
import tsBlankSpace from 'ts-blank-space'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'
import path from 'node:path'
import { Server } from 'node:http'
import { createApp } from './server.ts'

/**
* `pages/index.ts` can have:
- `Head`
- `Page`

`pages/index.server.ts` can have:
- `PageSchema = {}`
- `PageData()`

`pages/index.util.ts` should have:
- Any extra types
- `Routes = {}`
*/
const importMap = {
	imports: {
		preact: '/dependencies/preact.js',
		'preact/hooks': '/dependencies/preact-hooks.js',
		'preact/debug': '/dependencies/preact-debug.js',
		'@preact/signals': '/dependencies/preact-signals.js',
		'htm/preact': '/dependencies/htm-preact.js',
		valibot: '/dependencies/valibot.js',
		'@shopify/draggable': '/dependencies/shoppify-draggable.js',
		'#components/': '/components/',
		'#lib': '/lib.ts',
		'#pages/': '/pages/',
		'#utilities/': '/utilities/',
	},
}

export function startServer(args: string[]) {
	if (args.includes('--bundle')) {
		console.info('Bundling dependencies...')
		bundleDependencies()
	}

	const app = createApp()
	app.get('/lib.ts', (req, res) => serveJs(req, res, './devserver') as any)
	app.get('/components/*path', (req, res) => serveJs(req, res, './devserver') as any)
	app.get('/pages/*path', (req, res) => serveJs(req, res, './devserver') as any)
	app.post('/pages/*page', async (req, res) => {
		type Params = { page: string[] }
		const pageId = (req.params as Params).page.join('/')
		const body = req.body
		try {
			const module = await import(`./pages/${pageId}.server.ts`)
			const result = (await module?.PageData?.(body)) ?? {}
			res.setHeader('Content-Type', 'application/json')
			res.send(result)
		} catch (err) {
			console.error(err)
			if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
				res.setHeader('Content-Type', 'application/json')
				res.send('{}\n')
			} else {
				res.status(500)
			}
		}
	})
	app.get('/utilities/*path', (req, res) => serveJs(req, res, '.') as any)
	app.use(express.static('./devserver/static'))

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
			console.info(`Listening on http://localhost:${port}`)
		})
	}
	createServer()
}

export async function bundleDependencies() {
	const rollupInput = {} as Record<string, string>

	for (const [importId, uri] of Object.entries(
		importMap.imports as Record<string, string>,
	)) {
		if (importId.startsWith('#')) {
			continue
		}

		if (!uri.startsWith('/dependencies/')) {
			continue
		}

		const file = uri.replace(/^\/dependencies\//u, '').replace(/\.js$/, '')
		rollupInput[file] = importId
	}

	let bundle
	try {
		bundle = await rollup({
			input: rollupInput,
			plugins: [nodeResolve()],
		})
		await bundle.write({
			dir: path.join(import.meta.dirname, './static/dependencies'),
			format: 'es',
		})
	} catch (error) {
		console.error(error)
		process.exit(1)
	}
	if (bundle) {
		await bundle.close()
	}
}

async function serveJs(req: Request, res: Response, relPath: string) {
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

export async function renderPage(req: Request, res: Response) {
	const id = req.url.slice(1) || 'index'
	const clientFile = `../devserver/pages/${id}.ts`
	const serverFile = `../devserver/pages/${id}.server.ts`

	let head = ''
	let page = ''
	const module1 = await import(clientFile)
	let module2: Record<string, unknown> | { PageData: any } = {}
	try {
		module2 = await import(serverFile)
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') {
			console.error(err)
			res.status(500)
		}
	}
	head = module1?.Head?.() ?? ''
	const result = (await module2?.PageData?.()) ?? {}
	try {
		page = render(h(() => module1.Page(result)))
	} catch (err) {
		console.error(`Failed to call "Page()" for "${clientFile}"`)
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
									<link rel="stylesheet" href="/vendor/bulma-v1.0.2/css/bulma.css" />
									<link rel="stylesheet" href="/css/global.css" />
								</head>
								${head}
								<script type="importmap">
								${JSON.stringify(importMap, null, '\t')}
								</script>
								<script type="module">
									import 'preact/debug'
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
							</html>\n`),
	)
}

function stripImports(text: string) {
	return text.replaceAll(
		/(?:^|\n)import.*?from[ \t]*['"](.*?)['"].*?\n/g,
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
