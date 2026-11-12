// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
import * as clack from '@clack/prompts'
import { execa, parseCommandString } from 'execa'
import toml from 'smol-toml'

import { pkgRoot } from '#common'
import { detectFiletypes } from '#utilities/filetype.ts'

import type { CommandFormatOptions, Config } from '#types'

type Formatter = {
	filetype: string
	command: string
	configFile: string
}

const FORMATTERS: Record<string, Formatter> = {
	yamlfmt: {
		filetype: 'yaml',
		command: 'yamlfmt -conf {config_file}',
		configFile: path.join(pkgRoot(), 'config/.yamlfmt.yaml'),
	},
}

/** Directories whose files are never handed to a formatter. */
const FORMAT_IGNORE = ['**/node_modules/**', '**/.data/**']

export async function run(options: CommandFormatOptions) {
	const rootDir = process.cwd()
	const overrides = await getFormatOverrides(rootDir)
	// Format what is actually on disk, so files excluded by `.gitignore` (and the
	// directory the user is in, if it is gitignored) and symlinked files are
	// included. Only dependencies and dev's own data directories are skipped.
	const filesByFiletype = await detectFiletypes({
		rootDir,
		gitignore: false,
		followSymbolicLinks: true,
		ignore: FORMAT_IGNORE,
	})

	let formatterIds: string[]
	if (options.formatter) {
		if (!(options.formatter in FORMATTERS)) {
			console.error(
				`Unknown formatter "${options.formatter}". Available formatters: ${new Intl.ListFormat(
					'en',
				).format(Object.keys(FORMATTERS))}`,
			)
			process.exitCode = 1
			return
		}
		formatterIds = [options.formatter]
	} else {
		const selection = await promptForFormatters(filesByFiletype)
		if (!selection) {
			return
		}
		formatterIds = selection
	}

	for (const formatterId of formatterIds) {
		const formatter = FORMATTERS[formatterId]
		const files = filesByFiletype[formatter.filetype] ?? []
		if (files.length === 0) {
			console.info(
				`[${styleText('yellow', 'SKIP')}] ${formatterId}: no ${formatter.filetype} files found`,
			)
			continue
		}

		const command = overrides[formatterId] ?? formatter.command
		const [file, ...args] = parseCommandString(
			command.replaceAll('{config_file}', formatter.configFile),
		)
		if (!file) {
			console.error(`Formatter "${formatterId}" has an empty command`)
			process.exitCode = 1
			continue
		}

		console.info(
			`[${styleText('blue', 'RUN')}] ${formatterId}: formatting ${files.length} ${formatter.filetype} file(s)`,
		)
		try {
			await execa(file, [...args, ...files], { cwd: rootDir, stdio: 'inherit' })
		} catch (err) {
			console.error(
				`[${styleText('red', 'FAIL')}] ${formatterId}: ${(err as Error).message}`,
			)
			process.exitCode = 1
		}
	}
}

async function promptForFormatters(
	filesByFiletype: Record<string, string[]>,
): Promise<string[] | undefined> {
	const available = Object.entries(FORMATTERS).filter(
		([, formatter]) => (filesByFiletype[formatter.filetype]?.length ?? 0) > 0,
	)
	if (available.length === 0) {
		console.info('No files found to format.')
		return
	}

	const selection = await clack.multiselect({
		message: 'Which formatter(s) would you like to run?',
		options: available.map(([formatterId, formatter]) => ({
			value: formatterId,
			label: formatterId,
			hint: `${filesByFiletype[formatter.filetype].length} ${formatter.filetype} file(s)`,
		})),
		initialValues: available.map(([formatterId]) => formatterId),
		required: true,
	})

	if (clack.isCancel(selection)) {
		clack.cancel('Cancelled.')
		return
	}

	return selection
}

async function getFormatOverrides(rootDir: string): Promise<Record<string, string>> {
	let config: Config
	try {
		config = toml.parse(
			await fs.readFile(path.join(rootDir, 'dev.toml'), 'utf-8'),
		) as Config
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
			return {}
		}
		throw err
	}

	const overrides: Record<string, string> = {}
	for (const [formatterId, command] of Object.entries(config.format ?? {})) {
		if (typeof command === 'string' && command.trim() !== '') {
			overrides[formatterId] = command
		}
	}
	return overrides
}
