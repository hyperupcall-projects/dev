#!/usr/bin/env -S deno run --allow-read --allow-write
// @ts-nocheck

import { join, relative, resolve } from 'https://deno.land/std@0.224.0/path/mod.ts'
import { unified } from 'https://esm.sh/unified@11?bundle'
import remarkParse from 'https://esm.sh/remark-parse@11?bundle'

const CORRECT_HEADING_ORDER = [
	'Learning & Studying',
	'Resources',
	'Style Guides',
	'Formatting',
	'Linting',
	'Static Code Analysis',
	'Dynamic Code Analysis',
	'Build Systems',
	'Package Managers',
	'Documentation',
	'Testing',
	'Debugging',
	'Security',
	'Tools',
	'Libraries',
	'...',
	'People',
	'Conferences',
	'Blogs & Opinions',
	'Fun',
	'Other',
] as const

const ORDER_PLACEHOLDER = '...'
const BEFORE_PLACEHOLDER = CORRECT_HEADING_ORDER.slice(
	0,
	CORRECT_HEADING_ORDER.indexOf(ORDER_PLACEHOLDER),
)
const AFTER_PLACEHOLDER = CORRECT_HEADING_ORDER.slice(
	CORRECT_HEADING_ORDER.indexOf(ORDER_PLACEHOLDER) + 1,
)

const BEFORE_ORDER = new Map(
	BEFORE_PLACEHOLDER.map((heading, index) => [heading, index]),
)
const AFTER_ORDER = new Map(
	AFTER_PLACEHOLDER.map((heading, index) => [heading, index]),
)

const ORDER_ALIASES: Record<string, string[]> = {
	'Learning & Studying': ['learning & studying'],
	Resources: ['resources'],
	'Style Guides': ['style guides', 'style guide'],
	Formatting: ['formatting', 'formatter', 'formatters'],
	Linting: ['linting', 'linter', 'linters'],
	'Static Code Analysis': [
		'static code analysis',
		'static analysis',
		'linters static analysis',
		'linters and static analysis',
	],
	'Dynamic Code Analysis': [
		'dynamic code analysis',
		'dynamic analysis',
	],
	'Build Systems': ['build systems', 'build system'],
	'Package Managers': ['package managers', 'package manager'],
	Documentation: ['documentation', 'docs'],
	Testing: ['testing', 'tests'],
	Debugging: ['debugging', 'debuggers'],
	Security: ['security'],
	Tools: ['tools', 'tooling'],
	Libraries: ['libraries', 'library'],
	People: ['people'],
	Conferences: ['conferences', 'conference'],
	'Blogs & Opinions': [
		'blogs & opinions',
	],
	Fun: ['fun'],
	Other: ['other', 'others'],
}

interface PositionPoint {
	line: number
	column: number
	offset?: number
}

interface Position {
	start: PositionPoint
	end: PositionPoint
}

interface MarkdownNode {
	type: string
	depth?: number
	children?: MarkdownNode[]
	position?: Position
}

interface RootNode extends MarkdownNode {
	type: 'root'
	children: MarkdownNode[]
}

interface SectionBlock {
	heading: string
	canonicalHeading: string | null
	originalIndex: number
	startOffset: number
	endOffset: number
	raw: string
}

interface ReorderResult {
	content: string
	changed: boolean
	headingCounts: Map<string, number>
}

function normalizeHeading(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
}

function canonicalHeadingForOrder(heading: string): string | null {
	const normalized = normalizeHeading(heading)

	for (const orderedHeading of BEFORE_PLACEHOLDER) {
		if (normalizeHeading(orderedHeading) === normalized) {
			return orderedHeading
		}
	}

	for (const orderedHeading of AFTER_PLACEHOLDER) {
		if (normalizeHeading(orderedHeading) === normalized) {
			return orderedHeading
		}
	}

	for (const [canonicalHeading, aliases] of Object.entries(ORDER_ALIASES)) {
		if (aliases.includes(normalized)) {
			return canonicalHeading
		}
	}

	return null
}

function buildLineStarts(source: string): number[] {
	const starts = [0]
	for (let index = 0; index < source.length; index++) {
		if (source[index] === '\n') {
			starts.push(index + 1)
		}
	}
	return starts
}

function pointToOffset(point: PositionPoint | undefined, lineStarts: number[]): number {
	if (point === undefined) {
		throw new Error('Encountered a Markdown node without position information.')
	}

	if (typeof point.offset === 'number') {
		return point.offset
	}

	const lineStart = lineStarts[point.line - 1]
	if (lineStart === undefined) {
		throw new Error(`Invalid line number in Markdown position: ${point.line}`)
	}

	return lineStart + point.column - 1
}

function nodeStartOffset(node: MarkdownNode, lineStarts: number[]): number {
	return pointToOffset(node.position?.start, lineStarts)
}

function extractHeadingText(source: string, startOffset: number): string {
	const lineEnd = source.indexOf('\n', startOffset)
	const line = source.slice(
		startOffset,
		lineEnd === -1 ? source.length : lineEnd,
	)

	return line
		.replace(/^##\s+/, '')
		.replace(/\s+#+\s*$/, '')
		.trim()
}

function sortSections(sections: SectionBlock[]): SectionBlock[] {
	return [...sections].sort((left, right) => {
		const leftBefore = left.canonicalHeading
			? BEFORE_ORDER.get(left.canonicalHeading)
			: undefined
		const rightBefore = right.canonicalHeading
			? BEFORE_ORDER.get(right.canonicalHeading)
			: undefined

		if (leftBefore !== undefined || rightBefore !== undefined) {
			if (leftBefore !== undefined && rightBefore !== undefined) {
				return leftBefore - rightBefore || left.originalIndex - right.originalIndex
			}
			return leftBefore !== undefined ? -1 : 1
		}

		const leftAfter = left.canonicalHeading
			? AFTER_ORDER.get(left.canonicalHeading)
			: undefined
		const rightAfter = right.canonicalHeading
			? AFTER_ORDER.get(right.canonicalHeading)
			: undefined

		if (leftAfter !== undefined || rightAfter !== undefined) {
			if (leftAfter !== undefined && rightAfter !== undefined) {
				return leftAfter - rightAfter || left.originalIndex - right.originalIndex
			}
			return leftAfter === undefined ? -1 : 1
		}

		return left.originalIndex - right.originalIndex
	})
}

function reorderRegion(
	source: string,
	regionStartOffset: number,
	regionEndOffset: number,
	regionNodes: MarkdownNode[],
	lineStarts: number[],
	headingCounts: Map<string, number>,
): string {
	const h2Nodes = regionNodes.filter(
		(node) => node.type === 'heading' && node.depth === 2,
	)

	if (h2Nodes.length === 0) {
		return source.slice(regionStartOffset, regionEndOffset)
	}

	const sectionStarts = h2Nodes.map((node) => nodeStartOffset(node, lineStarts))
	const sections: SectionBlock[] = h2Nodes.map((node, index) => {
		const startOffset = sectionStarts[index]
		const endOffset =
			index + 1 < sectionStarts.length ? sectionStarts[index + 1] : regionEndOffset
		const heading = extractHeadingText(source, startOffset)
		headingCounts.set(heading, (headingCounts.get(heading) ?? 0) + 1)

		return {
			heading,
			canonicalHeading: canonicalHeadingForOrder(heading),
			originalIndex: index,
			startOffset,
			endOffset,
			raw: source.slice(startOffset, endOffset),
		}
	})

	const prefix = source.slice(regionStartOffset, sections[0].startOffset)
	const sortedSections = sortSections(sections)

	return prefix + sortedSections.map((section) => section.raw).join('')
}

function reorderMarkdown(source: string): ReorderResult {
	const tree = unified().use(remarkParse).parse(source) as RootNode
	const lineStarts = buildLineStarts(source)
	const headingCounts = new Map<string, number>()
	const rootNodes = tree.children ?? []

	if (rootNodes.length === 0) {
		return {
			content: source,
			changed: false,
			headingCounts,
		}
	}

	const h1Indices = rootNodes
		.map((node, index) => ({ node, index }))
		.filter(({ node }) => node.type === 'heading' && node.depth === 1)
		.map(({ index }) => index)

	const regionRanges: Array<{ startIndex: number; endIndex: number }> = []

	if (h1Indices.length === 0) {
		regionRanges.push({ startIndex: 0, endIndex: rootNodes.length })
	} else {
		if (h1Indices[0] > 0) {
			regionRanges.push({ startIndex: 0, endIndex: h1Indices[0] })
		}

		for (let index = 0; index < h1Indices.length; index++) {
			const startIndex = h1Indices[index]
			const endIndex =
				index + 1 < h1Indices.length ? h1Indices[index + 1] : rootNodes.length
			regionRanges.push({ startIndex, endIndex })
		}
	}

	let rebuilt = ''
	let previousRegionEndOffset = 0

	for (const { startIndex, endIndex } of regionRanges) {
		const regionNodes = rootNodes.slice(startIndex, endIndex)
		if (regionNodes.length === 0) {
			continue
		}

		const regionStartOffset = nodeStartOffset(regionNodes[0], lineStarts)
		const regionEndOffset =
			endIndex < rootNodes.length
				? nodeStartOffset(rootNodes[endIndex], lineStarts)
				: source.length

		rebuilt += source.slice(previousRegionEndOffset, regionStartOffset)
		rebuilt += reorderRegion(
			source,
			regionStartOffset,
			regionEndOffset,
			regionNodes,
			lineStarts,
			headingCounts,
		)
		previousRegionEndOffset = regionEndOffset
	}

	rebuilt += source.slice(previousRegionEndOffset)

	return {
		content: rebuilt,
		changed: rebuilt !== source,
		headingCounts,
	}
}

function isMarkdownPath(path: string): boolean {
	const lowercasePath = path.toLowerCase()
	return lowercasePath.endsWith('.md') || lowercasePath.endsWith('.markdown')
}

async function collectMarkdownFiles(targetPath: string): Promise<string[]> {
	const targetInfo = await Deno.stat(targetPath)

	if (targetInfo.isFile) {
		return [targetPath]
	}

	const files: string[] = []
	const stack = [targetPath]

	while (stack.length > 0) {
		const currentDirectory = stack.pop()!
		for await (const entry of Deno.readDir(currentDirectory)) {
			const entryPath = join(currentDirectory, entry.name)
			if (entry.isDirectory) {
				stack.push(entryPath)
				continue
			}

			if (entry.isFile && isMarkdownPath(entryPath)) {
				files.push(entryPath)
			}
		}
	}

	files.sort((left, right) => left.localeCompare(right))
	return files
}

function formatHeadingStats(headingCounts: Map<string, number>): string {
	const lines = [...headingCounts.entries()]
		.sort((left, right) => {
			if (right[1] !== left[1]) {
				return right[1] - left[1]
			}
			return left[0].localeCompare(right[0])
		})
		.map(([heading, count]) => `${String(count).padStart(4, ' ')}  ${heading}`)

	return ['Top-level ## heading frequency:', ...lines].join('\n')
}

function printUsage(): void {
	console.error('Usage: deno run --allow-read --allow-write ./organize_headings.ts [--dry-run] <file-or-directory>')
	console.error('')
	console.error('Reorders only root-level ## sections inside Markdown files.')
	console.error('Other content and all nested headings move with their parent ## section.')
}

async function main(): Promise<void> {
	const dryRun = Deno.args.includes('--dry-run')
	const unsupportedFlags = Deno.args.filter(
		(argument) => argument.startsWith('-') && argument !== '--dry-run',
	)

	if (unsupportedFlags.length > 0) {
		console.error(`Unsupported flag(s): ${unsupportedFlags.join(', ')}`)
		printUsage()
		Deno.exit(1)
	}

	const targets = Deno.args.filter((argument) => !argument.startsWith('-'))
	if (targets.length !== 1) {
		printUsage()
		Deno.exit(1)
	}

	const targetPath = resolve(targets[0])
	let files: string[] = []

	try {
		files = await collectMarkdownFiles(targetPath)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`Failed to read target: ${message}`)
		Deno.exit(1)
	}

	if (files.length === 0) {
		console.error('No Markdown files found.')
		Deno.exit(1)
	}

	const cwd = Deno.cwd()
	const globalHeadingCounts = new Map<string, number>()
	let changedFiles = 0
	let processedFiles = 0
	let hadErrors = false
	const dryRunOutputs: Array<{ path: string; content: string }> = []

	for (const filePath of files) {
		try {
			const source = await Deno.readTextFile(filePath)
			const result = reorderMarkdown(source)
			processedFiles += 1

			for (const [heading, count] of result.headingCounts) {
				globalHeadingCounts.set(
					heading,
					(globalHeadingCounts.get(heading) ?? 0) + count,
				)
			}

			if (result.changed) {
				changedFiles += 1
			}

			if (dryRun) {
				dryRunOutputs.push({
					path: relative(cwd, filePath) || filePath,
					content: result.content,
				})
			} else if (result.changed) {
				await Deno.writeTextFile(filePath, result.content)
			}
		} catch (error) {
			hadErrors = true
			const message = error instanceof Error ? error.message : String(error)
			console.error(`Failed to process ${relative(cwd, filePath) || filePath}: ${message}`)
		}
	}

	if (dryRun) {
		for (const output of dryRunOutputs) {
			console.log(`===== ${output.path} =====`)
			console.log(output.content)
			if (!output.content.endsWith('\n')) {
				console.log('')
			}
		}
	}

	const summaryLines = [
		`Processed files: ${processedFiles}`,
		`Changed files: ${changedFiles}`,
		formatHeadingStats(globalHeadingCounts),
	]

	if (dryRun) {
		console.error(summaryLines.join('\n\n'))
	} else {
		console.log(summaryLines.join('\n\n'))
	}

	if (hadErrors) {
		Deno.exit(1)
	}
}

if (import.meta.main) {
	await main()
}
