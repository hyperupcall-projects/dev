#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { URL } = require('url')

const CACHE_DIR = path.join(process.cwd(), '.cache')

/**
 * Parse command line arguments
 */
function parseArgs() {
	const args = process.argv.slice(2)
	return {
		refetchAll: args.includes('--refetch-all'),
		refetchEmpty: args.includes('--refetch-empty'),
	}
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
	if (!fs.existsSync(CACHE_DIR)) {
		fs.mkdirSync(CACHE_DIR, { recursive: true })
	}
}

/**
 * Get cache filename for a URL
 * @param {string} url - URL to get cache filename for
 * @returns {string} Cache filename
 */
function getCacheFilename(url) {
	try {
		const urlObj = new URL(url)
		const hostname = urlObj.hostname.replace(/\./g, '-')
		return hostname
	} catch (e) {
		return null
	}
}

/**
 * Check if favicon is cached
 * @param {string} cacheBase - Base cache filename without extension
 * @returns {{exists: boolean, isEmpty: boolean, path: string|null}}
 */
function checkCache(cacheBase) {
	const extensions = ['.png', '.ico', '.jpg', '.svg', '.gif']

	for (const ext of extensions) {
		const cachePath = path.join(CACHE_DIR, cacheBase + ext)
		if (fs.existsSync(cachePath)) {
			const stats = fs.statSync(cachePath)
			return {
				exists: true,
				isEmpty: stats.size === 0,
				path: cachePath,
			}
		}
	}

	return { exists: false, isEmpty: false, path: null }
}

/**
 * Download a file from URL
 * @param {string} url - URL to download from
 * @returns {Promise<Buffer|null>} Downloaded data or null
 */
function downloadFile(url) {
	return new Promise((resolve) => {
		const client = url.startsWith('https') ? https : http

		const request = client.get(url, { timeout: 10000 }, (response) => {
			if (response.statusCode === 301 || response.statusCode === 302) {
				// Follow redirect
				if (response.headers.location) {
					let redirectUrl = response.headers.location
					// Handle relative URLs by resolving them against the original URL
					if (
						!redirectUrl.startsWith('http://') &&
						!redirectUrl.startsWith('https://')
					) {
						try {
							const baseUrl = new URL(url)
							redirectUrl = new URL(redirectUrl, baseUrl.origin).href
						} catch (e) {
							resolve(null)
							return
						}
					}
					downloadFile(redirectUrl).then(resolve)
				} else {
					resolve(null)
				}
				return
			}

			if (response.statusCode !== 200) {
				resolve(null)
				return
			}

			const chunks = []
			response.on('data', (chunk) => chunks.push(chunk))
			response.on('end', () => {
				resolve(Buffer.concat(chunks))
			})
		})

		request.on('error', () => resolve(null))
		request.on('timeout', () => {
			request.destroy()
			resolve(null)
		})
	})
}

/**
 * Get file extension from content type or buffer
 * @param {string} contentType - Content-Type header
 * @param {Buffer} buffer - File buffer
 * @returns {string} File extension
 */
function getExtension(contentType, buffer) {
	if (contentType) {
		if (contentType.includes('png')) return '.png'
		if (
			contentType.includes('x-icon') ||
			contentType.includes('vnd.microsoft.icon')
		)
			return '.ico'
		if (contentType.includes('jpeg') || contentType.includes('jpg'))
			return '.jpg'
		if (contentType.includes('svg')) return '.svg'
		if (contentType.includes('gif')) return '.gif'
	}

	// Check magic bytes
	if (buffer && buffer.length >= 4) {
		const header = buffer.toString('hex', 0, 4)
		if (header === '89504e47') return '.png'
		if (header.startsWith('0000')) return '.ico'
		if (header === 'ffd8ffe0' || header === 'ffd8ffe1') return '.jpg'
		if (header.startsWith('3c737667') || header.startsWith('3c3f786d'))
			return '.svg'
		if (header === '47494638') return '.gif'
	}

	return '.ico'
}

/**
 * Fetch favicon for a URL
 * @param {string} url - URL to fetch favicon for
 * @param {Object} options - Options for refetching
 * @returns {Promise<string|null>} Path to cached favicon or null
 */
async function fetchFavicon(url, options = {}) {
	const cacheBase = getCacheFilename(url)
	if (!cacheBase) return null

	const cached = checkCache(cacheBase)

	// Check if we should skip fetching
	if (cached.exists && !options.refetchAll) {
		if (!cached.isEmpty || !options.refetchEmpty) {
			return cached.path
		}
	}

	try {
		const urlObj = new URL(url)
		const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`

		// Try common favicon locations
		const faviconUrls = [
			`${baseUrl}/favicon.ico`,
			`${baseUrl}/favicon.png`,
			`${baseUrl}/apple-touch-icon.png`,
			`${baseUrl}/apple-touch-icon-precomposed.png`,
		]

		for (const faviconUrl of faviconUrls) {
			const data = await downloadFile(faviconUrl)

			if (data && data.length > 0) {
				const ext = getExtension(null, data)
				const cachePath = path.join(CACHE_DIR, cacheBase + ext)

				// Remove old cache files with different extensions
				const extensions = ['.png', '.ico', '.jpg', '.svg', '.gif']
				for (const oldExt of extensions) {
					const oldPath = path.join(CACHE_DIR, cacheBase + oldExt)
					if (oldPath !== cachePath && fs.existsSync(oldPath)) {
						fs.unlinkSync(oldPath)
					}
				}

				fs.writeFileSync(cachePath, data)
				return cachePath
			}
		}

		// No favicon found, create empty file
		const emptyPath = path.join(CACHE_DIR, cacheBase + '.ico')
		fs.writeFileSync(emptyPath, '')
		return null
	} catch (e) {
		// On error, create empty file
		const emptyPath = path.join(CACHE_DIR, cacheBase + '.ico')
		fs.writeFileSync(emptyPath, '')
		return null
	}
}

/**
 * Recursively finds all markdown files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} fileList - Accumulator for file paths
 * @returns {string[]} Array of markdown file paths
 */
function findMarkdownFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir)

	files.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)

		if (stat.isDirectory()) {
			// Skip hidden directories and common non-content directories
			if (!file.startsWith('.') && file !== 'node_modules') {
				findMarkdownFiles(filePath, fileList)
			}
		} else if (stat.isFile() && file.endsWith('.md')) {
			fileList.push(filePath)
		}
	})

	return fileList
}

/**
 * Extracts all markdown links from content
 * @param {string} content - Markdown file content
 * @returns {Array<{title: string, url: string}>} Array of link objects
 */
function extractLinks(content) {
	// Regex to match markdown links: [text](url)
	const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
	const links = []
	let match

	while ((match = linkRegex.exec(content)) !== null) {
		const title = match[1].trim()
		const url = match[2].trim()

		// Only include valid HTTP(S) URLs
		if (url.startsWith('http://') || url.startsWith('https://')) {
			links.push({ title, url })
		}
	}

	return links
}

/**
 * Groups bookmarks by their source markdown file
 * @param {string} dir - Base directory to search
 * @returns {Array<{filename: string, links: Array}>} Grouped bookmarks
 */
function collectBookmarks(dir) {
	const markdownFiles = findMarkdownFiles(dir)
	const bookmarkGroups = []

	markdownFiles.forEach((filePath) => {
		const content = fs.readFileSync(filePath, 'utf-8')
		const links = extractLinks(content)

		if (links.length > 0) {
			const relativePath = path.relative(dir, filePath)
			const filename = path.basename(filePath, '.md')

			bookmarkGroups.push({
				filename,
				relativePath,
				links,
			})
		}
	})

	return bookmarkGroups
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	}
	return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Generates Firefox-compatible HTML bookmark file
 * @param {Array} bookmarkGroups - Grouped bookmarks
 * @param {Map} faviconMap - Map of URLs to favicon paths
 * @returns {string} HTML content
 */
function generateBookmarkHTML(bookmarkGroups, faviconMap) {
	const timestamp = Math.floor(Date.now() / 1000)

	let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>

<DL><p>
    <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">Already Organized2</H3>
    <DL><p>
`

	// Add each markdown file as a folder
	bookmarkGroups.forEach((group) => {
		html += `        <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${escapeHtml(group.filename)}</H3>\n`
		html += `        <DL><p>\n`

		// Add each link in the file
		group.links.forEach((link) => {
			const faviconPath = faviconMap.get(link.url)
			let iconAttr = ''

			if (faviconPath && fs.existsSync(faviconPath)) {
				const iconData = fs.readFileSync(faviconPath)
				if (iconData.length > 0) {
					const base64 = iconData.toString('base64')
					const ext = path.extname(faviconPath).substring(1)
					let mimeType = 'image/x-icon'
					if (ext === 'png') mimeType = 'image/png'
					else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
					else if (ext === 'svg') mimeType = 'image/svg+xml'
					else if (ext === 'gif') mimeType = 'image/gif'

					iconAttr = ` ICON="data:${mimeType};base64,${base64}"`
				}
			}

			html += `            <DT><A HREF="${escapeHtml(link.url)}" ADD_DATE="${timestamp}"${iconAttr}>${escapeHtml(link.title)}</A>\n`
		})

		html += `        </DL><p>\n`
	})

	html += `    </DL><p>
</DL><p>
`

	return html
}

/**
 * Fetch all favicons in parallel with concurrency limit
 * @param {Array} bookmarkGroups - Grouped bookmarks
 * @param {Object} options - Fetch options
 * @returns {Promise<Map>} Map of URLs to favicon paths
 */
async function fetchAllFavicons(bookmarkGroups, options) {
	const allUrls = new Set()
	bookmarkGroups.forEach((group) => {
		group.links.forEach((link) => {
			allUrls.add(link.url)
		})
	})

	const urls = Array.from(allUrls)
	const faviconMap = new Map()

	console.log(`\nFetching favicons for ${urls.length} unique URLs...`)

	// Process in batches to limit concurrency
	const BATCH_SIZE = 50
	let completed = 0

	for (let i = 0; i < urls.length; i += BATCH_SIZE) {
		const batch = urls.slice(i, i + BATCH_SIZE)
		const promises = batch.map((url) => fetchFavicon(url, options))
		const results = await Promise.all(promises)

		batch.forEach((url, index) => {
			faviconMap.set(url, results[index])
		})

		completed += batch.length
		process.stdout.write(`\rProgress: ${completed}/${urls.length}`)
	}

	console.log('\nFavicon fetching complete!')

	return faviconMap
}

/**
 * Main function
 */
async function main() {
	const args = parseArgs()
	const currentDir = process.cwd()

	console.log(`Searching for markdown files in: ${currentDir}`)

	const bookmarkGroups = collectBookmarks(currentDir)

	console.log(`Found ${bookmarkGroups.length} markdown files with links`)

	let totalLinks = 0
	bookmarkGroups.forEach((group) => {
		totalLinks += group.links.length
		console.log(`  - ${group.relativePath}: ${group.links.length} links`)
	})

	console.log(`Total links: ${totalLinks}`)

	// Ensure cache directory exists
	ensureCacheDir()

	// Fetch favicons
	const faviconMap = await fetchAllFavicons(bookmarkGroups, {
		refetchAll: args.refetchAll,
		refetchEmpty: args.refetchEmpty,
	})

	const html = generateBookmarkHTML(bookmarkGroups, faviconMap)
	const outputFile = 'bookmarks.html'

	fs.writeFileSync(outputFile, html, 'utf-8')

	console.log(`\nBookmark file generated: ${outputFile}`)
	console.log('You can now import this file into Firefox via:')
	console.log(
		'Bookmarks → Show All Bookmarks → Import and Backup → Import Bookmarks from HTML',
	)
	console.log('\nOptions:')
	console.log('  --refetch-all    Refetch all favicons, ignoring cache')
	console.log('  --refetch-empty  Refetch only empty favicon files')
}

// Run the program
main().catch(console.error)
