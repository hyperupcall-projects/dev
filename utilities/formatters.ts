// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2026 Edwin Kofler
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import Ajv from 'ajv'
import toml from 'smol-toml'

import type { Config, FormatConfig } from '#types'
import type { Formatter } from '#utilities/config.ts'
import { pkgRoot } from '#utilities/util.ts'

export const globalFormatConfigPath = path.join(pkgRoot(), 'config/dev-global.toml')
const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile({
	type: 'object',
	properties: {
		rules: {
			type: 'object',
			additionalProperties: { enum: ['off'] },
		},
		updateVersionDirectories: {
			type: 'array',
			items: { type: 'string' },
		},
		format: {
			type: 'object',
			additionalProperties: false,
			properties: {
				filetypes: {
					type: 'object',
					additionalProperties: {
						anyOf: [{ type: 'string', minLength: 1 }, { const: false }],
					},
				},
			},
		},
		lint: false,
	},
})

export async function readToolConfig(
	filepath: string,
	optional = false,
): Promise<Config> {
	let source: string
	try {
		source = await fs.readFile(filepath, 'utf-8')
	} catch (err) {
		if (optional && (err as NodeJS.ErrnoException).code === 'ENOENT') return {}
		throw err
	}
	const config = toml.parse(source)
	if (!validate(config)) {
		throw new Error(
			`${filepath}: ${ajv.errorsText(validate.errors, { dataVar: 'config' })}`,
		)
	}
	return config as Config
}

export async function loadFormatConfig(
	projectFormat: FormatConfig | undefined,
	tools: Record<string, Formatter>,
	globalPath = globalFormatConfigPath,
): Promise<Required<FormatConfig>> {
	const defaults = (await readToolConfig(globalPath)).format
	const config = {
		filetypes: { ...defaults?.filetypes, ...projectFormat?.filetypes },
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
	const config = await readToolConfig(filepath, true)
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
