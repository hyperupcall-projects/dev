#!/usr/bin/env node

/**
 * Search for duplicate https links across all markdown files.
 *
 * Usage:
 *   ./scripts/search_duplicates_all.ts [--fix] [paths...]
 *
 * Arguments:
 *   --fix  Remove duplicate lines from TODO.md when the same URL appears elsewhere
 *   paths  Optional files or directories to search (default: current directory)
 *
 * Recursively scans all *.md files. Reports every https:// URL that appears
 * more than once (within or across files). Each duplicate occurrence beyond
 * the first is counted toward the total.
 *
 * With --fix, one matching line per duplicate URL is removed from TODO.md at the
 * end via regex (line numbers are not used):
 *   - URL in TODO.md and another file → remove one matching line from TODO.md
 *   - URL only in TODO.md multiple times → remove one matching line from TODO.md
 *   - Duplicates not involving TODO.md are left unchanged
 */

import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'node:url'

const HTTPS_LINK_RE = /https:\/\/[^\s<>"')\]]+/g

interface LinkLocation {
	file: string
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

function normalizeUrl(url: string): string {
	return url.replace(/[.,;:!?)]+$/, '')
}

function isTodoFile(filePath: string): boolean {
	return path.basename(filePath) === 'TODO.md'
}

function fileUriWithLocation(
	filePath: string,
	location: Pick<LinkLocation, 'line' | 'column'>,
): string {
	// pathToFileURL encodes spaces; & must be encoded too or KDE misparses the URI
	const href = pathToFileURL(path.resolve(filePath)).href.replace(/&/g, '%26')
	return `${href}:${location.line}:${location.column}`
}

function terminalLink(
	text: string,
	filePath: string,
	location: Pick<LinkLocation, 'line' | 'column'>,
): string {
	const uri = fileUriWithLocation(filePath, location)
	return `\x1b]8;;${uri}\x1b\\${text}\x1b]8;;\x1b\\`
}

function indexHttpsLinksInFile(filePath: string): Map<string, LinkLocation[]> {
	const content = fs.readFileSync(filePath, 'utf-8')
	const links = new Map<string, LinkLocation[]>()
	const lines = content.split('\n')

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]
		for (const url of extractUrlsFromLine(line)) {
			const location: LinkLocation = {
				file: filePath,
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

function buildGlobalLinks(markdownFiles: string[]): Map<string, LinkLocation[]> {
	const globalLinks = new Map<string, LinkLocation[]>()

	for (const markdownFile of markdownFiles) {
		for (const [url, locations] of indexHttpsLinksInFile(markdownFile)) {
			const existing = globalLinks.get(url)
			if (existing) {
				existing.push(...locations)
			} else {
				globalLinks.set(url, [...locations])
			}
		}
	}

	return globalLinks
}

function getDuplicateUrls(
	globalLinks: Map<string, LinkLocation[]>,
): Array<[string, LinkLocation[]]> {
	return [...globalLinks.entries()]
		.filter(([, locations]) => locations.length > 1)
		.sort(([urlA], [urlB]) => urlA.localeCompare(urlB))
}

function countDuplicates(duplicateUrls: Array<[string, LinkLocation[]]>): number {
	let duplicateCount = 0
	for (const [, locations] of duplicateUrls) {
		duplicateCount += locations.length - 1
	}
	return duplicateCount
}

function printDuplicates(
	duplicateUrls: Array<[string, LinkLocation[]]>,
	cwd: string,
): void {
	for (const [url, locations] of duplicateUrls) {
		const [first, ...rest] = locations
		const firstRelative = path.relative(cwd, first.file) || first.file

		console.log(url)
		console.log(
			`  ${terminalLink(firstRelative, first.file, first)}:${first.line}:${first.column}`,
		)

		for (const location of rest) {
			const relativePath = path.relative(cwd, location.file) || location.file
			console.log(
				`  ${terminalLink(relativePath, location.file, location)}:${location.line}:${location.column}`,
			)
		}

		console.log('')
	}
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lineMatchesUrl(line: string, url: string): boolean {
	return new RegExp(escapeRegex(url)).test(line)
}

interface FixPlan {
	removeOneLineFromTodo: Set<string>
}

function buildFixPlan(duplicateUrls: Array<[string, LinkLocation[]]>): FixPlan {
	const removeOneLineFromTodo = new Set<string>()

	for (const [url, locations] of duplicateUrls) {
		const hasTodoLocation = locations.some((location) => isTodoFile(location.file))
		if (hasTodoLocation) {
			removeOneLineFromTodo.add(url)
		}
	}

	return { removeOneLineFromTodo }
}

function getAffectedFiles(plan: FixPlan, markdownFiles: string[]): string[] {
	if (plan.removeOneLineFromTodo.size === 0) {
		return []
	}

	return markdownFiles.filter((filePath) => isTodoFile(filePath)).sort()
}

function applyFixToFile(filePath: string, plan: FixPlan): number {
	if (!isTodoFile(filePath) || plan.removeOneLineFromTodo.size === 0) {
		return 0
	}

	const content = fs.readFileSync(filePath, 'utf-8')
	const lines = content.split('\n')
	const removedUrls = new Set<string>()
	const keptLines: string[] = []
	let removedCount = 0

	for (const line of lines) {
		let shouldRemove = false

		for (const url of plan.removeOneLineFromTodo) {
			if (removedUrls.has(url) || !lineMatchesUrl(line, url)) {
				continue
			}

			shouldRemove = true
			removedUrls.add(url)
			break
		}

		if (shouldRemove) {
			removedCount++
		} else {
			keptLines.push(line)
		}
	}

	if (removedCount > 0) {
		fs.writeFileSync(filePath, keptLines.join('\n'))
	}

	return removedCount
}

function applyFix(plan: FixPlan, markdownFiles: string[], cwd: string): number {
	const affectedFiles = getAffectedFiles(plan, markdownFiles)
	let totalRemoved = 0

	for (const filePath of affectedFiles) {
		const removedCount = applyFixToFile(filePath, plan)
		if (removedCount === 0) {
			continue
		}

		const relativePath = path.relative(cwd, filePath) || filePath
		console.error(`Removed ${removedCount} line(s) from ${relativePath}`)
		totalRemoved += removedCount
	}

	return totalRemoved
}

function printUsage(): void {
	console.error('Usage: ./scripts/search_duplicates_all.ts [--fix] [paths...]')
	console.error('')
	console.error('Options:')
	console.error(
		'  --fix  Remove duplicate lines from TODO.md when the same URL appears elsewhere',
	)
	console.error('')
	console.error('Arguments:')
	console.error('  paths  Optional files or directories to search (default: .)')
}

function parseArgs(args: string[]): { fix: boolean; searchPaths: string[] } {
	const fix = args.includes('--fix')
	const searchPaths = args.filter((arg) => arg !== '--fix')
	return {
		fix,
		searchPaths: searchPaths.length > 0 ? searchPaths : ['.'],
	}
}

function main(): void {
	const { fix, searchPaths } = parseArgs(process.argv.slice(2))
	const cwd = process.cwd()
	const markdownFiles = collectMarkdownFiles(searchPaths)

	if (markdownFiles.length === 0) {
		console.error('No markdown files found.')
		process.exit(1)
	}

	let globalLinks = buildGlobalLinks(markdownFiles)
	const duplicateUrls = getDuplicateUrls(globalLinks)
	const duplicateCount = countDuplicates(duplicateUrls)

	printDuplicates(duplicateUrls, cwd)
	console.error(`Total duplicates: ${duplicateCount}`)

	if (fix) {
		const plan = buildFixPlan(duplicateUrls)
		const hasWork = plan.removeOneLineFromTodo.size > 0

		if (!hasWork) {
			console.error('No fixable duplicates involving TODO.md.')
		} else {
			const totalRemoved = applyFix(plan, markdownFiles, cwd)
			console.error(`Total lines removed: ${totalRemoved}`)
		}
	}

	if (duplicateCount > 0) {
		process.exit(1)
	}
}

main()
