#!/usr/bin/env node

/**
 * Firefox Bookmark Parser
 *
 * Reads a Firefox bookmark JSON export and prints bookmarks in Markdown format.
 *
 * Usage:
 *   node parse_bookmarks.js <bookmark_file.json> [filter_folder]
 *
 * Arguments:
 *   bookmark_file.json - Path to the exported Firefox bookmark JSON file
 *   filter_folder      - Optional folder name to filter by (recursive)
 *
 * Output:
 *   Markdown formatted list: - [title](url)
 */

import * as fs from 'fs'
import * as path from 'path'

// Firefox bookmark types
type BookmarkType =
	| 'text/x-moz-place'
	| 'text/x-moz-place-container'
	| 'text/x-moz-place-separator'

interface BookmarkItem {
	guid?: string
	title?: string
	index?: number
	dateAdded?: number
	lastModified?: number
	id?: number
	typeCode?: number
	type?: BookmarkType
	root?: string
	uri?: string
	iconuri?: string
	children?: BookmarkItem[]
}

interface FirefoxBookmarkExport {
	guid: string
	title: string
	index: number
	dateAdded: number
	lastModified: number
	id: number
	typeCode: number
	type: BookmarkType
	root: string
	children: BookmarkItem[]
}

interface ParsedBookmark {
	title: string
	url: string
}

/**
 * Recursively find all bookmarks in a folder structure
 */
function findAllBookmarks(item: BookmarkItem): ParsedBookmark[] {
	const bookmarks: ParsedBookmark[] = []

	// If this is a bookmark (has a URI), add it
	if (item.uri && item.title) {
		bookmarks.push({
			title: item.title,
			url: item.uri,
		})
	}

	// If this has children, recursively process them
	if (item.children && Array.isArray(item.children)) {
		for (const child of item.children) {
			bookmarks.push(...findAllBookmarks(child))
		}
	}

	return bookmarks
}

/**
 * Find a folder by name (case-insensitive, recursive search)
 */
function findFolder(
	item: BookmarkItem,
	folderName: string,
): BookmarkItem | null {
	// Check if this item is the folder we're looking for
	if (
		item.type === 'text/x-moz-place-container' &&
		item.title &&
		item.title.toLowerCase() === folderName.toLowerCase()
	) {
		return item
	}

	// If this has children, search recursively
	if (item.children && Array.isArray(item.children)) {
		for (const child of item.children) {
			const found = findFolder(child, folderName)
			if (found) {
				return found
			}
		}
	}

	return null
}

/**
 * Parse bookmarks from Firefox JSON export
 */
function parseBookmarks(
	data: FirefoxBookmarkExport,
	filterFolder?: string,
): ParsedBookmark[] {
	if (filterFolder) {
		// Find the specific folder
		const folder = findFolder(data, filterFolder)

		if (!folder) {
			console.error(`Error: Folder "${filterFolder}" not found in bookmarks`)
			process.exit(1)
		}

		// Get all bookmarks from that folder
		return findAllBookmarks(folder)
	} else {
		// No filter, get all bookmarks
		return findAllBookmarks(data)
	}
}

/**
 * Format bookmarks as Markdown
 */
function formatAsMarkdown(bookmarks: ParsedBookmark[]): string {
	return bookmarks
		.map((bookmark) => `- [${bookmark.title}](${bookmark.url})`)
		.join('\n')
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2)

	if (args.length < 1) {
		console.error(
			'Usage: node parse_bookmarks.js <bookmark_file.json> [filter_folder]',
		)
		console.error('')
		console.error('Arguments:')
		console.error(
			'  bookmark_file.json - Path to the exported Firefox bookmark JSON file',
		)
		console.error(
			'  filter_folder      - Optional folder name to filter by (recursive)',
		)
		console.error('')
		console.error('Example:')
		console.error('  node parse_bookmarks.js bookmarks.json')
		console.error('  node parse_bookmarks.js bookmarks.json "My Folder"')
		process.exit(1)
	}

	const bookmarkFile = args[0]
	const filterFolder = args[1]

	// Check if file exists
	if (!fs.existsSync(bookmarkFile)) {
		console.error(`Error: File "${bookmarkFile}" not found`)
		process.exit(1)
	}

	try {
		// Read and parse the JSON file
		const fileContent = fs.readFileSync(bookmarkFile, 'utf-8')
		const bookmarkData: FirefoxBookmarkExport = JSON.parse(fileContent)

		// Parse bookmarks
		const bookmarks = parseBookmarks(bookmarkData, filterFolder)

		// Format and print
		const markdown = formatAsMarkdown(bookmarks)
		console.log(markdown)

		// Print summary to stderr
		console.error(`\nTotal bookmarks: ${bookmarks.length}`)
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`)
		} else {
			console.error('An unknown error occurred')
		}
		process.exit(1)
	}
}

// Run main function
main()
