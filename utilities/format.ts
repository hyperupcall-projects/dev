// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2026 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
import { MultiSelectPrompt, SelectPrompt } from '@clack/core'
import * as clack from '@clack/prompts'
import { Table } from 'console-table-printer'
import { execa } from 'execa'
import toml from 'smol-toml'

import type { Config, FormatConfig } from '#types'
import type { Formatter, Linter } from '#utilities/config.ts'
import { detectFiletypes } from '#utilities/filetype.ts'
import { loadConfig, loadConfigFile, pkgRoot } from '#utilities/util.ts'

export function resolveFormatConfig(
	format: FormatConfig | undefined,
	tools: Record<string, Formatter>,
): Required<FormatConfig> {
	const config = {
		filetypes: { ...format?.filetypes },
	}
	for (const [filetype, formatter] of Object.entries(config.filetypes)) {
		if (formatter !== false && !tools[formatter]?.filetypes.includes(filetype)) {
			throw new Error(`Formatter "${formatter}" does not support "${filetype}" files`)
		}
	}
	return config
}

export async function saveFormatter(
	filepath: string,
	filetype: string,
	formatter: string | false | undefined,
) {
	const config = await loadConfigFile(filepath, true)
	config.format ??= {}
	config.format.filetypes ??= {}
	if (formatter === undefined) delete config.format.filetypes[filetype]
	else config.format.filetypes[filetype] = formatter
	await fs.writeFile(filepath, toml.stringify(config))
}

export function groupFilesByFormatter(
	filesByFiletype: Record<string, string[]>,
	preferences: Record<string, string | false>,
): Record<string, string[]> {
	const grouped: Record<string, string[]> = {}
	for (const [filetype, files] of Object.entries(filesByFiletype)) {
		const formatter = preferences[filetype]
		if (typeof formatter === 'string') (grouped[formatter] ??= []).push(...files)
	}
	return Object.fromEntries(
		Object.entries(grouped).map(([id, files]) => [id, [...new Set(files)]]),
	)
}

export async function runFormatOrLint(
	tools: Record<string, Formatter | Linter>,
	action: 'format' | 'lint',
	config: Config,
	toolId?: string,
) {
	const rootDir = process.cwd()
	let format: Required<FormatConfig> | undefined
	try {
		format = action === 'format' ? resolveFormatConfig(config.format, tools) : undefined
	} catch (err) {
		console.error(`Cannot load ${action} configuration: ${(err as Error).message}`)
		process.exitCode = 1
		return
	}
	const filesByFiletype = await detectFiletypes({ rootDir })
	let filesByTool = Object.fromEntries(
		Object.entries(tools).map(([id, tool]) => [
			id,
			[...new Set(tool.filetypes.flatMap((type) => filesByFiletype[type] ?? []))],
		]),
	)

	let toolIds: string[]
	if (toolId) {
		if (!Object.hasOwn(tools, toolId)) {
			console.error(
				`Unknown tool "${toolId}". Available tools: ${new Intl.ListFormat('en').format(
					Object.keys(tools),
				)}`,
			)
			process.exitCode = 1
			return
		}
		toolIds = [toolId]
	} else {
		if (format) {
			let selected: string[] | undefined
			try {
				selected = await pickFormatFiletypes(
					rootDir,
					tools,
					filesByFiletype,
					format,
					config,
				)
			} catch (err) {
				console.error((err as Error).message)
				process.exitCode = 1
				return
			}
			if (!selected) {
				return
			}
			filesByTool = groupFilesByFormatter(
				Object.fromEntries(selected.map((type) => [type, filesByFiletype[type]])),
				format.filetypes,
			)
		}
		const available = Object.keys(tools).filter((id) => filesByTool[id]?.length > 0)
		if (available.length === 0) {
			console.info(
				format
					? 'No files selected with a configured formatter.'
					: 'No files found to lint.',
			)
			return
		}

		if (format) {
			toolIds = available
		} else {
			const all = Symbol('all')
			const selection = await clack.multiselect<string | typeof all>({
				message: 'Which would you like to run?',
				options: [
					{ value: all, label: 'All applicable' },
					...available.map((id) => ({
						value: id,
						label: `${id} (${filesByTool[id].length} ${tools[id].filetypes.join(', ')} files)`,
					})),
				],
				initialValues: available,
				required: true,
			})
			if (clack.isCancel(selection)) {
				clack.cancel('Cancelled.')
				return
			}
			toolIds = selection.includes(all)
				? available
				: selection.filter((id): id is string => typeof id === 'string')
		}
	}

	for (const id of toolIds) {
		const tool = tools[id]
		const files = filesByTool[id]
		const filetypes = tool.filetypes.join(', ')
		if (files.length === 0) {
			console.info(`[${styleText('yellow', 'SKIP')}] ${id}: no ${filetypes} files found`)
			continue
		}

		const run = tool.run
		if (!run[0]) {
			console.error(`Tool "${id}" has an empty command`)
			process.exitCode = 1
			continue
		}

		console.info(`[${styleText('blue', 'RUN')}] ${id}: ${files.length} file(s)`)
		try {
			await execa({ cwd: rootDir, stdio: 'inherit' })`${run} ${files}`
		} catch (err) {
			console.error(`[${styleText('red', 'FAIL')}] ${id}: ${(err as Error).message}`)
			process.exitCode = 1
		}
	}
}

function stopCursorWrapping(
	prompt: MultiSelectPrompt<{ value: string }> | SelectPrompt<{ value: string }>,
) {
	let cursor = prompt.cursor
	// Clack's own cursor handler runs first; replace its wrap with a bounded move.
	prompt.on('cursor', (direction) => {
		if (direction === 'up' || direction === 'left') {
			prompt.cursor = Math.max(0, cursor - 1)
		} else if (direction === 'down' || direction === 'right') {
			prompt.cursor = Math.min(prompt.options.length - 1, cursor + 1)
		}
		cursor = prompt.cursor
		if (prompt instanceof SelectPrompt) prompt.value = prompt.options[cursor].value
	})
}

export async function pickFormatFiletypes(
	rootDir: string,
	tools: Record<string, Formatter>,
	files: Record<string, string[]>,
	format: Required<FormatConfig>,
	config: Config,
): Promise<string[] | undefined> {
	const globalPath = path.join(pkgRoot(), 'config/dev-global.toml')
	const projectPath = path.join(rootDir, 'dev.toml')
	// Read the unmerged file to distinguish project assignments in the editor.
	let project = await loadConfigFile(projectPath, true)
	const filetypes = Object.keys(files)
		.filter((type) => files[type].length > 0)
		.sort()
	if (filetypes.length === 0) return []
	const renderTable = (selection?: string[], cursor?: string) => {
		const table = new Table({
			shouldDisableColors: true,
			columns: [
				{ name: 'filetype', title: 'Filetype', alignment: 'left' },
				{ name: 'files', title: 'Files', alignment: 'right' },
				{ name: 'formatter', title: 'Formatter', alignment: 'left' },
				{ name: 'scope', title: 'Scope', alignment: 'left' },
			],
		})
		for (const type of filetypes) {
			const marker = selection
				? `${cursor === type ? '›' : ' '} ${selection.includes(type) ? '■' : '□'} `
				: ''
			table.addRow({
				filetype: `${marker}${type}`,
				files: files[type].length,
				formatter: format.filetypes[type] || 'none',
				scope: Object.hasOwn(project.format?.filetypes ?? {}, type)
					? 'project'
					: 'global',
			})
		}
		return table.render()
	}
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		console.info(renderTable())
		throw new Error(
			'Use an interactive terminal to select filetypes, or run dev format <formatter>.',
		)
	}
	let selected = filetypes.filter((type) => typeof format.filetypes[type] === 'string')
	let cursorAt = filetypes[0]
	while (true) {
		let action: string | undefined
		const prompt = new MultiSelectPrompt({
			options: filetypes.map((value) => ({ value })),
			initialValues: selected,
			cursorAt,
			required: false,
			render() {
				if (this.state === 'cancel') return 'Formatting cancelled.'
				if (this.state === 'submit') return action ? '' : 'Filetypes selected.'
				// Keep the header and borders fixed while Clack scrolls the table rows.
				const [top, headings, divider, ...rows] = renderTable(
					this.value,
					this.options[this.cursor].value,
				).split('\n')
				const bottom = rows.pop()!
				return [
					'Which filetypes would you like to format?',
					top,
					headings,
					divider,
					...clack.limitOptions({
						options: rows,
						cursor: this.cursor,
						rowPadding: 11,
						style: (line, active) => (active ? styleText('cyan', line) : line),
					}),
					bottom,
					'↑/↓ move · space select · a all configured · enter run · esc cancel',
					'p project formatter · g global formatter · f show files',
				].join('\n')
			},
		})
		stopCursorWrapping(prompt)
		prompt.on('key', (key, info) => {
			if (info.name === 'a') {
				const configured = filetypes.filter(
					(type) => typeof format.filetypes[type] === 'string',
				)
				// Clack already toggled its options, so check the prior selection.
				prompt.value = configured.every((type) => selected.includes(type))
					? []
					: configured
			}
			selected = prompt.value ?? []
			if (key === 'p' || key === 'g' || key === 'f') {
				action = key
				prompt.state = 'submit'
			}
		})
		const result = await prompt.prompt()
		if (clack.isCancel(result) || result === undefined) return
		selected = result
		cursorAt = filetypes[prompt.cursor]
		if (!action) return selected
		if (action === 'f') {
			let cancelled = false
			const viewer = new SelectPrompt({
				options: files[cursorAt].map((file) => ({
					value: path.relative(rootDir, file),
				})),
				render() {
					if (this.state === 'cancel') return cancelled ? 'Formatting cancelled.' : ''
					if (this.state === 'submit') return ''
					return [
						`${cursorAt} files (${this.options.length})`,
						...clack.limitOptions({
							options: this.options,
							cursor: this.cursor,
							rowPadding: 4,
							style: ({ value }, active) =>
								active ? styleText('cyan', `› ${value}`) : `  ${value}`,
						}),
						'↑/↓ scroll · enter / esc back · ctrl+c cancel',
					].join('\n')
				},
			})
			stopCursorWrapping(viewer)
			viewer.on('key', (_, key) => {
				if (key.ctrl && key.name === 'c') cancelled = true
			})
			await viewer.prompt()
			if (cancelled) return
			continue
		}
		const isProject = action === 'p'
		const current = isProject
			? project.format?.filetypes?.[cursorAt]
			: (await loadConfigFile(globalPath, true)).format?.filetypes?.[cursorAt]
		const choice = await clack.select({
			message: `Formatter for ${cursorAt} (${isProject ? 'project' : 'global'})`,
			initialValue: isProject && current === undefined ? '$inherit' : current || '',
			options: [
				...(isProject ? [{ value: '$inherit', label: 'Use global default' }] : []),
				{ value: '', label: 'None' },
				...Object.keys(tools)
					.filter((id) => tools[id].filetypes.includes(cursorAt))
					.map((id) => ({ value: id, label: id })),
			],
		})
		if (clack.isCancel(choice)) continue
		await saveFormatter(
			isProject ? projectPath : globalPath,
			cursorAt,
			choice === '$inherit' ? undefined : choice || false,
		)
		project = await loadConfigFile(projectPath, true)
		Object.assign(config, await loadConfig(rootDir))
		Object.assign(format, resolveFormatConfig(config.format, tools))
		selected = selected.filter((type) => type !== cursorAt)
		if (typeof format.filetypes[cursorAt] === 'string') selected.push(cursorAt)
		clack.log.success(
			`Saved ${cursorAt} formatter in ${isProject ? 'dev.toml' : 'dev-global.toml'}.`,
		)
		if (!isProject && Object.hasOwn(project.format?.filetypes ?? {}, cursorAt)) {
			clack.log.info(
				'The project override still applies. Press p and choose Use global default to inherit it.',
			)
		}
	}
}
