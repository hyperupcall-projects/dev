import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
	getServiceData,
	launchServiceTerminal,
	controlService,
	updateServicePort,
} from '#utilities/util.ts'
import { processDictionaryFiles } from '../server/dictionary-watcher.ts'
import {
	listActivityProjects,
	openActivityProject,
} from '../server/activity-projects.ts'
import { compileBlocklists } from '../server/blocklists.ts'
import { getGardenCatalog } from '../server/garden-projects.ts'
import {
	openKnowledgeFolder,
	KNOWLEDGE_OPENER_IDS,
	type KnowledgeOpenerId,
} from '../server/knowledge-folders.ts'
import {
	FILE_EDITOR_IDS,
	openFile,
	type FileEditorId,
} from '../server/open-files.ts'
import { openProjects, IDE_IDS, type IdeId } from '../server/open-projects.ts'
import {
	COMPUTING_FOLDER_IDS,
	COMPUTING_FOLDER_OPENERS,
	openComputingFolder,
	listComputingFolders,
	type ComputingFolderId,
	type ComputingFolderOpener,
} from '../server/computing-folders.ts'
import {
	createSavedGroup,
	deleteSavedGroup,
	listSavedGroups,
	renameSavedGroup,
} from '../server/project-groups.ts'

function isLocalhostOrigin(origin: string): boolean {
	try {
		const hostname = new URL(origin).hostname
		return hostname === 'localhost' || hostname === '127.0.0.1'
	} catch {
		return false
	}
}

export const api = new Hono()

api.use(
	'*',
	cors({
		origin: (origin) =>
			origin && isLocalhostOrigin(origin) ? origin : '',
		allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type'],
	}),
)

api.get('/api/services', async (c) => c.json(await getServiceData()))

api.post('/api/services/launch-terminal', async (c) => {
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

api.post('/api/services/control', async (c) => {
	const body = (await c.req.json()) as {
		service?: string
		action?: 'start' | 'stop' | 'restart' | 'enable' | 'disable'
	}
	const actions = ['start', 'stop', 'restart', 'enable', 'disable'] as const
	if (!body.service || !body.action || !actions.includes(body.action)) {
		return c.json(
			{
				error:
					'Expected { service, action: "start" | "stop" | "restart" | "enable" | "disable" }',
			},
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

api.post('/api/services/port', async (c) => {
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

api.post('/api/dictionary/process-files', async (c) =>
	c.json(await processDictionaryFiles()),
)

api.get('/api/projects', async (c) => c.json(await getGardenCatalog()))

api.get('/api/computing-folders', async (c) =>
	c.json(await listComputingFolders()),
)

api.post('/api/computing-folders/open', async (c) => {
	const body = (await c.req.json()) as {
		folderId?: string
		subdirectoryId?: string
		opener?: string
	}
	if (!body.folderId || !COMPUTING_FOLDER_IDS.includes(body.folderId as ComputingFolderId)) {
		return c.json({ error: 'Expected a valid computing folder id' }, 400)
	}
	if (!body.opener || !COMPUTING_FOLDER_OPENERS.includes(body.opener as ComputingFolderOpener)) {
		return c.json(
			{ error: `Expected opener to be one of: ${COMPUTING_FOLDER_OPENERS.join(', ')}` },
			400,
		)
	}
	try {
		return c.json(
			await openComputingFolder({
				folderId: body.folderId as ComputingFolderId,
				subdirectoryId: body.subdirectoryId,
				opener: body.opener as ComputingFolderOpener,
			}),
		)
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			400,
		)
	}
})

api.post('/api/projects/open', async (c) => {
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

api.get('/api/project-groups', async (c) => c.json(await listSavedGroups()))

api.post('/api/project-groups', async (c) => {
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

api.patch('/api/project-groups/:id', async (c) => {
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

api.delete('/api/project-groups/:id', async (c) => {
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

api.get('/api/activity', async (c) => c.json(await listActivityProjects()))

api.post('/api/activity/open', async (c) => {
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

api.post('/api/blocklists/compile', async (c) => {
	try {
		return c.json(await compileBlocklists())
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			500,
		)
	}
})

api.post('/api/files/open', async (c) => {
	const body = (await c.req.json()) as {
		path?: string
		editor?: string
		line?: number
		column?: number
	}
	if (!body.editor || !FILE_EDITOR_IDS.includes(body.editor as FileEditorId)) {
		return c.json(
			{ error: `Expected editor to be one of: ${FILE_EDITOR_IDS.join(', ')}` },
			400,
		)
	}
	if (typeof body.path !== 'string' || !body.path) {
		return c.json({ error: 'Expected { path, editor }' }, 400)
	}
	try {
		return c.json(
			await openFile({
				path: body.path,
				editor: body.editor as FileEditorId,
				line: body.line,
				column: body.column,
			}),
		)
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			400,
		)
	}
})

api.post('/api/knowledge/open', async (c) => {
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
