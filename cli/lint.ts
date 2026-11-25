// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import { runFormatOrLint } from '#utilities/format.ts'
import { Linters } from '#utilities/config.ts'
import type { Config } from '#types'

export async function run(options: { config: Config; linter?: string; dir?: string }) {
	await runFormatOrLint(Linters, 'lint', options.config, options.linter)
}
