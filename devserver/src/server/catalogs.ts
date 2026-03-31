import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const catalogsDir = process.env.CATALOGS_DIR || '~/Documents/Catalogs/build'
const resolvedCatalogsDir = catalogsDir.startsWith('~')
	? path.join(os.homedir(), catalogsDir.slice(1))
	: catalogsDir

const mimeByExtension: Record<string, string> = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
}

export async function serveCatalogPath(relativePath: string) {
	const normalized = relativePath.replace(/^\/+/, '')
	const candidate = path.resolve(resolvedCatalogsDir, normalized || '.')
	const base = path.resolve(resolvedCatalogsDir)

	// Prevent escaping CATALOGS_DIR via traversal segments.
	if (!candidate.startsWith(base)) {
		return new Response('Not Found', { status: 404 })
	}

	const stats = await fs.stat(candidate).catch(() => null)
	if (!stats) {
		return new Response('Not Found', { status: 404 })
	}

	const fileToRead = stats.isDirectory() ? path.join(candidate, 'index.html') : candidate
	const fileStats = await fs.stat(fileToRead).catch(() => null)
	if (!fileStats || !fileStats.isFile()) {
		return new Response('Not Found', { status: 404 })
	}

	const body = await fs.readFile(fileToRead)
	const ext = path.extname(fileToRead)
	const contentType = mimeByExtension[ext] ?? 'application/octet-stream'

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': contentType,
		},
	})
}
