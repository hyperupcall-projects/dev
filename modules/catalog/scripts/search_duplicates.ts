#!/usr/bin/env node

/**
 * Search for duplicate https links between a source text file and markdown files.
 *
 * Usage:
 *   ./scripts/search_duplicates.ts <original_file> [paths...]
 *
 * Arguments:
 *   original_file  Text file containing https:// links to check against
 *   paths          Optional files or directories to search (default: current directory)
 *
 * Searches all *.md files recursively under each path. For every markdown file,
 * prints its relative path and reports duplicates in the form:
 *   Found duplicate: https://example.com
 * where "Found duplicate" is a terminal hyperlink to the original file and line number.
 *
 * At the end, prints all links from the original file that were not found in any
 * markdown file.
 */

import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'node:url'

const HTTPS_LINK_RE = /https:\/\/[^\s<>"')\]]+/g

interface LinkLocation {
	line: number
	column: number
}

function extractUrlsFromLine(line: string): string[] {
	const urls = new Set<string>()
	for (const match of line.matchAll(HTTPS_LINK_RE)) {
		urls.add(normalizeUrl(match[0]))
	}
	return [...urls]
}

function columnForUrl(line: string, url: string): number {
	let column = 1
	for (const match of line.matchAll(HTTPS_LINK_RE)) {
		if (normalizeUrl(match[0]) === url) {
			column = (match.index ?? 0) + 1
		}
	}
	return column
}

function indexHttpsLinksByLine(content: string): Map<string, LinkLocation[]> {
	const links = new Map<string, LinkLocation[]>()
	const lines = content.split('\n')

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]
		for (const url of extractUrlsFromLine(line)) {
			const location: LinkLocation = {
				line: index + 1,
				column: columnForUrl(line, url),
			}
			const locations = links.get(url)
			if (locations) {
				locations.push(location)
			} else {
				links.set(url, [location])
			}
		}
	}

	return links
}

function normalizeUrl(url: string): string {
	return url.replace(/[.,;:!?)]+$/, '')
}

function fileUriWithLocation(filePath: string, location: LinkLocation): string {
	const href = pathToFileURL(path.resolve(filePath)).href.replace(/&/g, '%26')
	return `${href}:${location.line}:${location.column}`
}

function terminalLink(text: string, filePath: string, location: LinkLocation): string {
	const uri = fileUriWithLocation(filePath, location)
	return `\x1b]8;;${uri}\x1b\\${text}\x1b]8;;\x1b\\`
}

function findHttpsLinksWithLines(filePath: string): Array<{ url: string; line: number }> {
	const content = fs.readFileSync(filePath, 'utf-8')
	const results: Array<{ url: string; line: number }> = []
	const lines = content.split('\n')

	for (let index = 0; index < lines.length; index++) {
		for (const url of extractUrlsFromLine(lines[index])) {
			results.push({
				url,
				line: index + 1,
			})
		}
	}

	return results
}

function collectMarkdownFiles(searchPaths: string[]): string[] {
	const markdownFiles = new Set<string>()

	for (const searchPath of searchPaths) {
		const resolved = path.resolve(searchPath)

		if (!fs.existsSync(resolved)) {
			console.error(`Warning: path not found: ${searchPath}`)
			continue
		}

		const stat = fs.statSync(resolved)
		if (stat.isFile()) {
			if (resolved.endsWith('.md')) {
				markdownFiles.add(resolved)
			}
			continue
		}

		walkDirectory(resolved, markdownFiles)
	}

	return [...markdownFiles].sort()
}

function walkDirectory(directory: string, markdownFiles: Set<string>): void {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			walkDirectory(entryPath, markdownFiles)
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
			markdownFiles.add(entryPath)
		}
	}
}

function printUsage(): void {
	console.error('Usage: ./scripts/search_duplicates.ts <original_file> [paths...]')
	console.error('')
	console.error('Arguments:')
	console.error('  original_file  Text file containing https:// links to check against')
	console.error('  paths          Optional files or directories to search (default: .)')
}

function main(): void {
	const args = process.argv.slice(2)

	if (args.length < 1) {
		printUsage()
		process.exit(1)
	}

	const originalFile = path.resolve(args[0])
	const searchPaths = args.length > 1 ? args.slice(1) : ['.']

	if (!fs.existsSync(originalFile)) {
		console.error(`Error: file not found: ${args[0]}`)
		process.exit(1)
	}

	const originalContent = fs.readFileSync(originalFile, 'utf-8')
	const originalLinks = indexHttpsLinksByLine(originalContent)

	if (originalLinks.size === 0) {
		console.error(`Warning: no https:// links found in ${args[0]}`)
	}

	const markdownFiles = collectMarkdownFiles(searchPaths).filter(
		(filePath) => path.resolve(filePath) !== originalFile,
	)

	let duplicateCount = 0
	const duplicateUrls = new Set<string>()
	const cwd = process.cwd()

	for (const markdownFile of markdownFiles) {
		const relativePath = path.relative(cwd, markdownFile) || markdownFile
		const duplicates: string[] = []

		for (const { url } of findHttpsLinksWithLines(markdownFile)) {
			const originalLocations = originalLinks.get(url)
			if (originalLocations === undefined) {
				continue
			}

			duplicateUrls.add(url)
			const originalLocation = originalLocations[0]
			duplicates.push(
				`${terminalLink('Found duplicate', originalFile, originalLocation)}: ${url}`,
			)
		}

		if (duplicates.length > 0) {
			console.log(relativePath)
			for (const line of duplicates) {
				console.log(line)
			}
			duplicateCount += duplicates.length
		}
	}

	if (duplicateCount > 0) {
		console.error(`\nTotal duplicates: ${duplicateCount}`)
	}

	const uniqueLinks = [...originalLinks.entries()]
		.filter(([url]) => !duplicateUrls.has(url))
		.map(([url, locations]) => ({ url, location: locations[0] }))

	if (uniqueLinks.length > 0) {
		console.log('\nUnique')
		for (const { url, location } of uniqueLinks) {
			console.log(`${terminalLink('Unique', originalFile, location)}: ${url}`)
		}
	}

	console.error(`\nTotal unique: ${uniqueLinks.length}`)

	if (duplicateCount > 0) {
		process.exit(1)
	}
}

main()
