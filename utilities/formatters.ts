// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2026 Edwin Kofler
import * as fs from 'node:fs/promises'
import toml from 'smol-toml'

import type { FormatConfig } from '#types'
import type { Formatter } from '#utilities/config.ts'
import { loadConfigFile } from '#utilities/util.ts'

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
