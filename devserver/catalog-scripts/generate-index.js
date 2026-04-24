#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const CACHE_DIR = path.join(process.cwd(), '.cache')

/**
 * Configuration: Directory ordering
 * Use "Root" to represent root files (files in the . directory)
 * Directories not in this array will appear after these, sorted alphabetically
 */
const DIRECTORY_ORDER = [
	'Root',
	'Areas',
	'Computing Areas',
	'Computing Other',
	'Computer Applications',
	'Computer Programs',
	'Computing Languages & Environments',

	'Design',
	'Lists',
]

/**
 * Recursively finds all HTML files in a directory
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for calculating relative paths
 * @param {string[]} fileList - Accumulator for file paths
 * @returns {string[]} Array of HTML file paths
 */
function findHtmlFiles(dir, baseDir, fileList = []) {
	const files = fs.readdirSync(dir)

	files.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)

		if (stat.isDirectory()) {
			findHtmlFiles(filePath, baseDir, fileList)
		} else if (
			stat.isFile() &&
			file.endsWith('.html') &&
			file !== 'index.html'
		) {
			const relativePath = path.relative(baseDir, filePath)
			fileList.push(relativePath)
		}
	})

	return fileList
}

/**
 * Groups files by directory
 * @param {string[]} files - Array of file paths
 * @returns {Object} Grouped files by directory
 */
function groupFilesByDirectory(files) {
	const groups = {}

	files.forEach((file) => {
		const dir = path.dirname(file)
		const basename = path.basename(file, '.html')

		if (!groups[dir]) {
			groups[dir] = []
		}

		groups[dir].push({
			name: basename,
			path: file,
		})
	})

	// Sort files within each group
	Object.keys(groups).forEach((key) => {
		groups[key].sort((a, b) => a.name.localeCompare(b.name))
	})

	return groups
}

/**
 * Validates directory ordering configuration
 * @param {string[]} orderConfig - Configured directory order
 * @param {string[]} actualDirs - Actual directories found
 */
function validateDirectoryOrder(orderConfig, actualDirs) {
	// Convert "Root" to "." for comparison
	const normalizedConfig = orderConfig.map((dir) =>
		dir === 'Root' ? '.' : dir,
	)
	const normalizedActual = actualDirs.slice()

	// Check for entries in config that don't correspond to actual directories
	normalizedConfig.forEach((configDir) => {
		if (!normalizedActual.includes(configDir)) {
			const displayName = configDir === '.' ? 'Root' : configDir
			console.warn(
				`⚠️  Warning: Directory "${displayName}" in DIRECTORY_ORDER does not exist`,
			)
		}
	})

	// Check for directories that are not in the config
	normalizedActual.forEach((actualDir) => {
		if (!normalizedConfig.includes(actualDir)) {
			const displayName = actualDir === '.' ? 'Root' : actualDir
			console.warn(
				`⚠️  Warning: Directory "${displayName}" is not in DIRECTORY_ORDER`,
			)
		}
	})
}

/**
 * Sorts directories according to configuration
 * @param {string[]} directories - Directories to sort
 * @param {string[]} orderConfig - Configured directory order
 * @returns {string[]} Sorted directories
 */
function sortDirectories(directories, orderConfig) {
	// Convert "Root" to "." for sorting
	const normalizedOrder = orderConfig.map((dir) =>
		dir === 'Root' ? '.' : dir,
	)

	// Create a map of directory to order index
	const orderMap = new Map()
	normalizedOrder.forEach((dir, index) => {
		orderMap.set(dir, index)
	})

	return directories.sort((a, b) => {
		const orderA = orderMap.has(a) ? orderMap.get(a) : Infinity
		const orderB = orderMap.has(b) ? orderMap.get(b) : Infinity

		// If both have order indices, sort by those
		if (orderA !== Infinity && orderB !== Infinity) {
			return orderA - orderB
		}

		// If only one has an order index, it comes first
		if (orderA !== Infinity) return -1
		if (orderB !== Infinity) return 1

		// If neither has an order index, sort alphabetically
		return a.localeCompare(b)
	})
}

/**
 * Get cache filename for a URL
 * @param {string} url - URL to get cache filename for
 * @returns {string} Cache filename base (without extension)
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
 * Find cached favicon for a URL
 * @param {string} url - URL to find favicon for
 * @returns {string|null} Path to cached favicon or null
 */
function findCachedFavicon(url) {
	const cacheBase = getCacheFilename(url)
	if (!cacheBase) return null

	const extensions = ['.png', '.ico', '.jpg', '.svg', '.gif']

	for (const ext of extensions) {
		const cachePath = path.join(CACHE_DIR, cacheBase + ext)
		if (fs.existsSync(cachePath)) {
			const stats = fs.statSync(cachePath)
			// Only return non-empty files
			if (stats.size > 0) {
				return cachePath
			}
		}
	}

	return null
}

/**
 * Get base64 encoded favicon
 * @param {string} faviconPath - Path to favicon file
 * @returns {string|null} Base64 data URL or null
 */
function getFaviconDataUrl(faviconPath) {
	try {
		const iconData = fs.readFileSync(faviconPath)
		if (iconData.length === 0) return null

		const base64 = iconData.toString('base64')
		const ext = path.extname(faviconPath).substring(1)
		let mimeType = 'image/x-icon'
		if (ext === 'png') mimeType = 'image/png'
		else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
		else if (ext === 'svg') mimeType = 'image/svg+xml'
		else if (ext === 'gif') mimeType = 'image/gif'

		return `data:${mimeType};base64,${base64}`
	} catch (e) {
		return null
	}
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
 * Processes an individual HTML file to add home link and make external links open in new tabs
 * @param {string} filePath - Path to the HTML file
 * @param {string} buildDir - Base build directory
 */
function processHtmlFile(filePath, buildDir) {
	const fullPath = path.join(buildDir, filePath)

	if (!fs.existsSync(fullPath)) {
		return
	}

	let content = fs.readFileSync(fullPath, 'utf-8')

	// Calculate relative path to index.html
	const depth = filePath.split(path.sep).length - 1
	const homeLink =
		depth === 0 ? 'index.html' : '../'.repeat(depth) + 'index.html'

	// Add home link styles and button after <body> tag
	const homeNavHtml = `
<style>
.home-nav {
    position: sticky;
    top: 0;
    border: 1px solid gray;
    border-radius: 3px;
    padding: 12px 20px;
    margin: -8px -8px 20px -8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    z-index: 1000;
}
.home-link {
    color: white;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.95em;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.home-link:hover {
    opacity: 0.8;
}
.favicon-icon {
    width: 16px;
    height: 16px;
    margin-right: 6px;
    vertical-align: middle;
    display: inline-block;
}
</style>
<div class="home-nav">
    <a href="${homeLink}" class="home-link">
        <span>🏠</span>
        <span>Go to Home</span>
    </a>
</div>
`

	// Insert home navigation after <body> tag
	content = content.replace(/<body([^>]*)>/, `<body$1>${homeNavHtml}`)

	// Make external links open in new tabs and add favicons
	// Match <a> tags with href that start with http:// or https://
	content = content.replace(
		/<a\s+([^>]*?)href=["'](https?:\/\/[^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi,
		(match, before, url, after, linkText) => {
			// Check if target attribute already exists
			let targetAttr = ''
			if (!/target\s*=/i.test(before + after)) {
				targetAttr = ' target="_blank" rel="noopener noreferrer"'
			}

			// Try to find favicon
			const faviconPath = findCachedFavicon(url)
			let faviconHtml = ''

			if (faviconPath) {
				const dataUrl = getFaviconDataUrl(faviconPath)
				if (dataUrl) {
					faviconHtml = `<img src="${dataUrl}" class="favicon-icon" alt="">`
				}
			}

			return `<a ${before}href="${url}"${after}${targetAttr}>${faviconHtml}${linkText}</a>`
		},
	)

	fs.writeFileSync(fullPath, content, 'utf-8')
}

/**
 * Generates the master index.html file
 * @param {Object} groupedFiles - Files grouped by directory
 * @returns {string} HTML content
 */
function generateIndexHtml(groupedFiles) {
	const directories = sortDirectories(
		Object.keys(groupedFiles),
		DIRECTORY_ORDER,
	)

	// Validate directory ordering
	validateDirectoryOrder(DIRECTORY_ORDER, Object.keys(groupedFiles))

	let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Catalog Index</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2.5em;
        }

        .subtitle {
            color: #7f8c8d;
            margin-bottom: 20px;
            font-size: 1.1em;
        }

        .section {
            margin-bottom: 40px;
        }

        h2 {
            color: #34495e;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
            font-size: 1.8em;
        }

        .file-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .file-link {
            display: block;
            padding: 15px 20px;
            background: #ecf0f1;
            border-radius: 5px;
            text-decoration: none;
            color: #2c3e50;
            border-left: 4px solid #3498db;
        }

        .file-link:hover {
            background: #3498db;
            color: white;
        }

        .stats {
            background: #e8f4f8;
            padding: 15px 20px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #3498db;
        }

        .stats-text {
            color: #2c3e50;
            font-size: 0.95em;
        }

        .root-section .file-list {
            background: #fff9e6;
            padding: 20px;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 Edwin's Catalog</h1>
        <p class="subtitle">Edwin's catalog of useful tools and resources.</p>

`

	// Generate sections for each directory
	directories.forEach((dir) => {
		const isRoot = dir === '.'
		const sectionClass = isRoot ? 'section root-section' : 'section'
		const title = isRoot ? '📄 Root Files' : `📁 ${escapeHtml(dir)}`

		html += `
        <div class="${sectionClass}">
            <h2>${title}</h2>
            <div class="file-list">
`

		groupedFiles[dir].forEach((file) => {
			html += `                <a href="${escapeHtml(file.path)}" class="file-link">${escapeHtml(file.name)}</a>\n`
		})

		html += `            </div>
        </div>
`
	})

	html += `    </div>
</body>
</html>
`

	return html
}

/**
 * Main function
 */
function main() {
	const buildDir = 'build'

	if (!fs.existsSync(buildDir)) {
		console.error(`Error: Build directory '${buildDir}' does not exist.`)
		console.error('Please run build.sh first to generate HTML files.')
		process.exit(1)
	}

	console.log('Searching for HTML files in build directory...')

	const htmlFiles = findHtmlFiles(buildDir, buildDir)

	if (htmlFiles.length === 0) {
		console.warn('Warning: No HTML files found in build directory.')
	} else {
		console.log(`Found ${htmlFiles.length} HTML files`)
	}

	// Process each HTML file to add home link and fix external links
	console.log('\nProcessing HTML files...')
	htmlFiles.forEach((file) => {
		processHtmlFile(file, buildDir)
		console.log(`  ✓ Processed: ${file}`)
	})

	const groupedFiles = groupFilesByDirectory(htmlFiles)
	const indexHtml = generateIndexHtml(groupedFiles)

	const outputPath = path.join(buildDir, 'index.html')
	fs.writeFileSync(outputPath, indexHtml, 'utf-8')

	console.log(`\n✓ Generated master index: ${outputPath}`)
	console.log(
		`  Files organized into ${Object.keys(groupedFiles).length} sections`,
	)
}

// Run the program
main()
