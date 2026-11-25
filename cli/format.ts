// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import { Formatters } from '#utilities/config.ts'
import { runFormatOrLint } from '#utilities/format.ts'
import type { Config } from '#types'

export async function run(options: { config: Config; formatter?: string; dir?: string }) {
	await runFormatOrLint(Formatters, 'format', options.config, options.formatter)
}
