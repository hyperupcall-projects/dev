import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getServiceData, launchServiceTerminal, controlService, updateServicePort } from '#utilities/util.ts'
import {
	activityManagerPage,
	dictionaryPage,
	knowledgeManagerPage,
	projectManagerPage,
	servicesPage,
} from './pages.ts'
import { processDictionaryFiles } from './server/dictionary-watcher.ts'
import {
	listActivityProjects,
	openActivityProject,
} from './server/activity-projects.ts'
import { getGardenCatalog } from './server/garden-projects.ts'
import {
	openKnowledgeFolder,
	KNOWLEDGE_OPENER_IDS,
	type KnowledgeOpenerId,
} from './server/knowledge-folders.ts'
import { openProjects, IDE_IDS, type IdeId } from './server/open-projects.ts'
import {
	createSavedGroup,
	deleteSavedGroup,
	listSavedGroups,
	renameSavedGroup,
} from './server/project-groups.ts'
import { serveUblacklistFile } from './server/ublacklist.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const app = new Hono()

const ublacklistFiles = [
	'ublacklist.txt',
	'ublacklist-compiled.txt',
	'ublacklist-severity1.txt',
	'ublacklist-severity2.txt',
	'ublacklist-severity3.txt',
	'ublacklist-severity4.txt',
	'ublockorigin-compiled.txt',
] as const

for (const filename of ublacklistFiles) {
	app.get(`/${filename}`, () => serveUblacklistFile(filename))
}

app.get('/api/services', async (c) => c.json(await getServiceData()))

app.post('/api/services/launch-terminal', async (c) => {
	const body = (await c.req.json()) as {
		service?: string
		action?: 'status' | 'journal'
	}
	if (!body.service || (body.action !== 'status' && body.action !== 'journal')) {
		return c.json({ error: 'Expected { service, action: "status" | "journal" }' }, 400)
	}
	try {
		return c.json(await launchServiceTerminal(body.service, body.action))
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			500,
		)
	}
})

app.post('/api/services/control', async (c) => {
	const body = (await c.req.json()) as {
		service?: string
		action?: 'start' | 'stop' | 'enable' | 'disable'
	}
	const actions = ['start', 'stop', 'enable', 'disable'] as const
	if (!body.service || !body.action || !actions.includes(body.action)) {
		return c.json(
			{ error: 'Expected { service, action: "start" | "stop" | "enable" | "disable" }' },
			400,
		)
	}
	try {
		return c.json(await controlService(body.service, body.action))
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			500,
		)
	}
})

app.post('/api/services/port', async (c) => {
	const body = (await c.req.json()) as {
		service?: string
		port?: string | number
	}
	if (!body.service || body.port == null || body.port === '') {
		return c.json({ error: 'Expected { service, port }' }, 400)
	}
	try {
		return c.json(await updateServicePort(body.service, String(body.port)))
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			500,
		)
	}
})

app.post('/api/dictionary/process-files', async (c) =>
	c.json(await processDictionaryFiles()),
)

app.get('/api/projects', async (c) => c.json(await getGardenCatalog()))

app.post('/api/projects/open', async (c) => {
	const body = (await c.req.json()) as {
		ide?: string
		projectIds?: string[]
	}
	if (!body.ide || !IDE_IDS.includes(body.ide as IdeId)) {
		return c.json(
			{ error: `Expected ide to be one of: ${IDE_IDS.join(', ')}` },
			400,
		)
	}
	if (!Array.isArray(body.projectIds) || body.projectIds.length === 0) {
		return c.json({ error: 'Expected non-empty projectIds array' }, 400)
	}
	try {
		return c.json(
			await openProjects({
				ide: body.ide as IdeId,
				projectIds: body.projectIds,
			}),
		)
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			400,
		)
	}
})

app.get('/api/project-groups', async (c) => c.json(await listSavedGroups()))

app.post('/api/project-groups', async (c) => {
	const body = (await c.req.json()) as {
		name?: string
		projectIds?: string[]
	}
	if (typeof body.name !== 'string' || !Array.isArray(body.projectIds)) {
		return c.json({ error: 'Expected { name, projectIds }' }, 400)
	}
	try {
		return c.json(await createSavedGroup(body.name, body.projectIds), 201)
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			400,
		)
	}
})

app.patch('/api/project-groups/:id', async (c) => {
	const id = c.req.param('id')
	const body = (await c.req.json()) as { name?: string }
	if (typeof body.name !== 'string') {
		return c.json({ error: 'Expected { name }' }, 400)
	}
	try {
		return c.json(await renameSavedGroup(id, body.name))
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const status = message.startsWith('Group not found') ? 404 : 400
		return c.json({ error: message }, status)
	}
})

app.delete('/api/project-groups/:id', async (c) => {
	const id = c.req.param('id')
	try {
		await deleteSavedGroup(id)
		return c.json({ ok: true })
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const status = message.startsWith('Group not found') ? 404 : 400
		return c.json({ error: message }, status)
	}
})

app.get('/api/activity', async (c) => c.json(await listActivityProjects()))

app.post('/api/activity/open', async (c) => {
	const body = (await c.req.json()) as { path?: string }
	if (typeof body.path !== 'string' || !body.path) {
		return c.json({ error: 'Expected { path }' }, 400)
	}
	try {
		return c.json(await openActivityProject(body.path))
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			400,
		)
	}
})

app.post('/api/knowledge/open', async (c) => {
	const body = (await c.req.json()) as {
		folderId?: string
		opener?: string
	}
	if (
		!body.opener ||
		!KNOWLEDGE_OPENER_IDS.includes(body.opener as KnowledgeOpenerId)
	) {
		return c.json(
			{
				error: `Expected opener to be one of: ${KNOWLEDGE_OPENER_IDS.join(', ')}`,
			},
			400,
		)
	}
	if (typeof body.folderId !== 'string' || !body.folderId) {
		return c.json({ error: 'Expected folderId' }, 400)
	}
	try {
		return c.json(
			await openKnowledgeFolder({
				folderId: body.folderId,
				opener: body.opener as KnowledgeOpenerId,
			}),
		)
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			400,
		)
	}
})

app.get('/', (c) => c.redirect('/services'))
app.get('/services', (c) => servicesPage())
app.get('/dictionary', (c) => dictionaryPage())
app.get('/activity', (c) => activityManagerPage())
app.get('/projects', (c) => projectManagerPage())
app.get('/knowledge', (c) => knowledgeManagerPage())

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

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Listening on http://localhost:${info.port}`)
})

export default app
