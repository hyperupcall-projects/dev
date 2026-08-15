import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderer } from './renderer.ts'
import { api } from './routes/api.ts'
import { pages } from './routes/pages.ts'
import { serveBlocklistFile } from './server/blocklists.ts'

const repoRoot = path.resolve(import.meta.dirname, '..')

const app = new Hono()

app.use(renderer)

app.use(async (c, next) => {
	const pathname = new URL(c.req.url).pathname
	const match = pathname.match(/^\/([A-Za-z0-9._-]+\.txt)$/)
	if (!match) {
		await next()
		return
	}
	return serveBlocklistFile(match[1]!)
})

app.route('/', api)
app.route('/', pages)

app.get('/vendor/bulma.min.css', async () => {
	const contents = await readFile(
		path.join(repoRoot, 'node_modules/bulma/css/bulma.min.css'),
	)
	return new Response(contents, {
		headers: { 'Content-Type': 'text/css; charset=utf-8' },
	})
})

app.use('/css/*', serveStatic({ root: './static' }))
app.get('/favicon.ico', serveStatic({ root: './static' }))
app.get('/favicon.svg', serveStatic({ root: './static' }))

export default app
