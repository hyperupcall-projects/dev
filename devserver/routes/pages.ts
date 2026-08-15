import { Hono } from 'hono'
import { blocklistsView } from '../views/blocklists.ts'
import { dictionaryView } from '../views/dictionary.ts'
import { directoriesView } from '../views/directories.ts'
import { openDirectoryView } from '../views/open-directory.ts'
import { openFileView } from '../views/open-file.ts'
import { projectManagerView } from '../views/project-manager.ts'
import { servicesView } from '../views/services.ts'
import { workspacesView } from '../views/workspaces.ts'

export const pages = new Hono()

pages.get('/', (c) => c.redirect('/services'))

pages.get('/services', async (c) => {
	const { title, content, scripts } = await servicesView()
	return c.render(content, { title, scripts })
})

pages.get('/dictionary', async (c) => {
	const { title, content, scripts } = await dictionaryView()
	return c.render(content, { title, scripts })
})

pages.get('/directories', async (c) => {
	const { title, content, scripts } = await directoriesView()
	return c.render(content, { title, scripts })
})

pages.get('/knowledge', (c) => c.redirect('/directories'))
pages.get('/activity', (c) => c.redirect('/directories'))

pages.get('/projects', async (c) => {
	const { title, content, scripts } = await projectManagerView()
	return c.render(content, { title, scripts })
})

pages.get('/docs/blocklists', async (c) => {
	const { title, content, scripts } = await blocklistsView()
	return c.render(content, { title, scripts })
})

pages.get('/docs/open-directory', async (c) => {
	const { title, content } = await openDirectoryView()
	return c.render(content, { title })
})

pages.get('/docs/open-file', (c) => {
	const { title, content } = openFileView()
	return c.render(content, { title })
})

pages.get('/docs/workspaces', (c) => {
	const { title, content } = workspacesView()
	return c.render(content, { title })
})

pages.get('/apis/blocklists', (c) => c.redirect('/docs/blocklists'))
