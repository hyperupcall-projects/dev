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

async function buildDirectoryListing(dirPath: string, relativeBase: string): Promise<string> {
	const entries = await fs.readdir(dirPath, { withFileTypes: true })

	const dirs: string[] = []
	const files: string[] = []

	for (const entry of entries) {
		if (entry.isDirectory()) {
			dirs.push(entry.name)
		} else if (entry.isFile() && entry.name.endsWith('.html')) {
			files.push(entry.name)
		}
	}

	dirs.sort((a, b) => a.localeCompare(b))
	files.sort((a, b) => a.localeCompare(b))

	const prefix = relativeBase ? `/${relativeBase}/` : '/'
	const title = relativeBase ? relativeBase : 'Catalog'
	const upLink = relativeBase
		? `<p><a href="/catalogs${relativeBase.includes('/') ? '/' + relativeBase.split('/').slice(0, -1).join('/') : ''}">⬆ Up</a></p>`
		: ''

	const dirItems = dirs
		.map((d) => `<li>📁 <a href="/catalogs${prefix}${encodeURIComponent(d)}">${d}</a></li>`)
		.join('\n')

	const fileItems = files
		.map((f) => {
			const name = f.replace(/\.html$/, '')
			return `<li>📄 <a href="/catalogs${prefix}${encodeURIComponent(f)}">${name}</a></li>`
		})
		.join('\n')

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; background: #f5f5f5; color: #333; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 0.5rem; }
    .notice { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.9em; }
    .notice a { color: #856404; font-weight: bold; }
    ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.5rem; }
    li a { display: block; padding: 0.6rem 1rem; background: white; border-radius: 4px; text-decoration: none; color: #2c3e50; border-left: 3px solid #3498db; transition: background 0.15s; }
    li a:hover { background: #3498db; color: white; }
    h2 { color: #34495e; margin-top: 1.5rem; }
    p a { color: #3498db; }
  </style>
</head>
<body>
  <h1>📚 ${title}</h1>
  <div class="notice">
    ⚠️ No <code>index.html</code> found. Run <a href="/catalogs-admin">Generate Index</a> in Catalog Admin to build a proper index.
  </div>
  ${upLink}
  ${dirs.length > 0 ? `<h2>Directories</h2><ul>${dirItems}</ul>` : ''}
  ${files.length > 0 ? `<h2>Pages</h2><ul>${fileItems}</ul>` : ''}
  ${dirs.length === 0 && files.length === 0 ? '<p>No HTML files found. Run <a href="/catalogs-admin">Build HTML</a> first.</p>' : ''}
</body>
</html>`
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

	if (stats.isDirectory()) {
		const indexPath = path.join(candidate, 'index.html')
		const indexStats = await fs.stat(indexPath).catch(() => null)

		if (indexStats?.isFile()) {
			let html = await fs.readFile(indexPath, 'utf-8')
			// Inject a <base> tag so relative links like href="Career.html" resolve
			// correctly against /catalogs/<subpath>/ regardless of trailing slash.
			const baseHref = `/catalogs/${normalized ? normalized.replace(/\/$/, '') + '/' : ''}`
			if (!html.includes('<base ')) {
				html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <base href="${baseHref}">`)
			}
			return new Response(html, {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		}

		// No index.html — generate a live directory listing instead of 404
		const relativeBase = normalized
		const html = await buildDirectoryListing(candidate, relativeBase)
		return new Response(html, {
			status: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		})
	}

	const fileStats = await fs.stat(candidate).catch(() => null)
	if (!fileStats?.isFile()) {
		return new Response('Not Found', { status: 404 })
	}

	const body = await fs.readFile(candidate)
	const ext = path.extname(candidate)
	const contentType = mimeByExtension[ext] ?? 'application/octet-stream'

	return new Response(body, {
		status: 200,
		headers: { 'Content-Type': contentType },
	})
}
