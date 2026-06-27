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

/** Compact column layout for the /catalogs index only. */
const catalogIndexOverrides = `<style id="catalog-index-overrides">
body { padding: 4px 8px !important; line-height: 1.3 !important; background: #fff !important; }
.container { display: flex !important; flex-wrap: wrap !important; align-items: flex-start !important; gap: 8px 20px !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border-radius: 0 !important; box-shadow: none !important; }
.container > h1, .container > .subtitle, .container > .stats { flex: 1 1 100% !important; width: 100% !important; }
h1 { font-size: 1.25rem !important; margin-bottom: 2px !important; border-bottom: none !important; color: #222 !important; }
.subtitle { margin-bottom: 4px !important; font-size: 0.85em !important; color: #666 !important; }
.section { flex: 0 0 auto !important; width: max-content !important; margin-bottom: 0 !important; }
h2 { font-size: 1rem !important; margin-bottom: 1px !important; padding-bottom: 1px !important; border-bottom: 1px solid #ccc !important; color: #333 !important; }
.file-list { display: flex !important; flex-direction: column !important; gap: 0 !important; margin-top: 0 !important; padding: 0 !important; background: transparent !important; border-radius: 0 !important; }
.file-link { display: block !important; padding: 1px 0 !important; border-radius: 0 !important; border-left: none !important; background: transparent !important; color: #222 !important; white-space: nowrap !important; }
.file-link:hover { background: #eee !important; color: #222 !important; }
.stats { padding: 4px 8px !important; margin-bottom: 3px !important; border-left: none !important; background: #f5f5f5 !important; }
</style>`

function injectCatalogIndexStyles(html: string): string {
	if (html.includes('catalog-index-overrides')) return html
	return html.replace(/<head([^>]*)>/i, `<head$1>\n${catalogIndexOverrides}`)
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 4px 8px; background: #fff; color: #333; line-height: 1.3; }
    h1 { color: #222; font-size: 1.25rem; margin: 0 0 4px 0; }
    .notice { background: #fff3cd; border: 1px solid #ffc107; padding: 4px 8px; margin-bottom: 6px; font-size: 0.85em; }
    .notice a { color: #856404; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0; }
    li a { display: block; padding: 2px 6px; text-decoration: none; color: #222; }
    li a:hover { background: #eee; }
    h2 { color: #333; font-size: 1rem; margin: 8px 0 4px 0; padding-bottom: 2px; border-bottom: 1px solid #ccc; }
    p { margin: 4px 0; }
    p a { color: #222; }
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
			if (normalized === '') {
				html = injectCatalogIndexStyles(html)
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
