#!/usr/bin/env node
/**
 * Markdown to HTML Bookmarks Converter
 *
 * Reads all markdown files recursively in the current working directory,
 * extracts links in the format [title](url), and generates an HTML bookmarks
 * file compatible with Firefox/Chrome bookmark imports.
 *
 * Each markdown file becomes a folder, and all links within that file
 * become bookmarks under that folder.
 *
 * Usage: node md_to_bookmarks.js [output_file.html]
 *
 * If no output file is specified, defaults to "bookmarks.html"
 */

const fs = require('fs')
const path = require('path')

/**
 * Recursively find all markdown files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} fileList - Accumulator for found files
 * @returns {string[]} Array of markdown file paths
 */
function findMarkdownFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir)

	for (const file of files) {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)

		if (stat.isDirectory()) {
			// Skip node_modules and hidden directories
			if (!file.startsWith('.') && file !== 'node_modules') {
				findMarkdownFiles(filePath, fileList)
			}
		} else if (file.endsWith('.md')) {
			fileList.push(filePath)
		}
	}

	return fileList
}

/**
 * Extract all markdown links from file content
 * @param {string} content - File content to parse
 * @returns {Array<{title: string, url: string, addDate: number}>} Array of bookmarks
 */
function extractLinks(content) {
	const bookmarks = []
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g
	const currentTime = Math.floor(Date.now() / 1000)

	let match
	while ((match = linkPattern.exec(content)) !== null) {
		const title = match[1]
		const url = match[2]

		// Only include valid URLs (http, https, ftp, etc.)
		if (url.match(/^(https?|ftp):\/\//i)) {
			bookmarks.push({
				title: title,
				url: url,
				addDate: currentTime,
			})
		}
	}

	return bookmarks
}

/**
 * Read markdown file and extract bookmarks
 * @param {string} filePath - Path to markdown file
 * @param {string} baseDir - Base directory for relative path calculation
 * @returns {{name: string, bookmarks: Array, addDate: number}|null} Bookmark folder or null
 */
function processMarkdownFile(filePath, baseDir) {
	try {
		const content = fs.readFileSync(filePath, 'utf-8')
		const bookmarks = extractLinks(content)

		if (bookmarks.length === 0) {
			return null
		}

		// Get relative path and use it as folder name (without .md extension)
		const relativePath = path.relative(baseDir, filePath)
		const folderName = relativePath.replace(/\.md$/, '')

		return {
			name: folderName,
			bookmarks: bookmarks,
			addDate: Math.floor(Date.now() / 1000),
		}
	} catch (error) {
		console.error(`Error processing ${filePath}:`, error)
		return null
	}
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

/**
 * Generate HTML bookmarks file content
 * @param {Array<{name: string, bookmarks: Array, addDate: number}>} folders - Bookmark folders
 * @returns {string} HTML content
 */
function generateBookmarksHtml(folders) {
	const lines = []
	const currentTime = Math.floor(Date.now() / 1000)

	// Header
	lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
	lines.push('<!-- This is an automatically generated file.')
	lines.push('     It will be read and overwritten.')
	lines.push('     DO NOT EDIT! -->')
	lines.push(
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
	)
	lines.push('<TITLE>Bookmarks</TITLE>')
	lines.push('<H1>Bookmarks</H1>')
	lines.push('')
	lines.push('<DL><p>')

	lines.push(
		`    <DT><H3 ADD_DATE="${currentTime}" LAST_MODIFIED="${currentTime}">Already Organized New</H3>`,
	)
	lines.push('    <DL><p>')

	// Add each folder with its bookmarks
	for (const folder of folders) {
		lines.push(
			`        <DT><H3 ADD_DATE="${folder.addDate}" LAST_MODIFIED="${folder.addDate}">${escapeHtml(folder.name)}</H3>`,
		)
		lines.push('        <DL><p>')

		for (const bookmark of folder.bookmarks) {
			const escapedTitle = escapeHtml(bookmark.title)
			const escapedUrl = escapeHtml(bookmark.url)
			lines.push(
				`            <DT><A HREF="${escapedUrl}" ADD_DATE="${bookmark.addDate}">${escapedTitle}</A>`,
			)
		}

		lines.push('        </DL><p>')
	}

	// Close top-level folder
	lines.push('    </DL><p>')
	lines.push('</DL><p>')

	return lines.join('\n')
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2)
	const outputFile = args[0] || 'bookmarks.html'
	const currentDir = process.cwd()

	console.log('Scanning for markdown files...')
	const markdownFiles = findMarkdownFiles(currentDir)
	console.log(`Found ${markdownFiles.length} markdown file(s)`)

	if (markdownFiles.length === 0) {
		console.log('No markdown files found in current directory')
		process.exit(0)
	}

	console.log('\nProcessing files...')
	const folders = []
	let totalBookmarks = 0

	for (const filePath of markdownFiles) {
		const folder = processMarkdownFile(filePath, currentDir)
		if (folder) {
			folders.push(folder)
			totalBookmarks += folder.bookmarks.length
			console.log(
				`  ✓ ${folder.name}: ${folder.bookmarks.length} bookmark(s)`,
			)
		}
	}

	if (folders.length === 0) {
		console.log('\nNo bookmarks found in any markdown files')
		process.exit(0)
	}

	console.log(`\nGenerating HTML bookmarks file...`)
	const html = generateBookmarksHtml(folders)

	// Write to output file
	fs.writeFileSync(outputFile, html, 'utf-8')

	console.log(`\n✓ Success!`)
	console.log(`  Output: ${outputFile}`)
	console.log(`  Folders: ${folders.length}`)
	console.log(`  Bookmarks: ${totalBookmarks}`)
	console.log(`\nYou can now import this file into Firefox or Chrome:`)
	console.log(
		`  Firefox: Menu → Bookmarks → Manage bookmarks → Import and Backup → Import Bookmarks from HTML`,
	)
	console.log(
		`  Chrome: Menu → Bookmarks → Bookmark manager → ⋮ → Import bookmarks`,
	)
}

// Run the script
main()
