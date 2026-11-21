// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import { runFormatOrLint } from './format.ts'
import { Linters } from '#utilities/config.ts'

export async function run(options: {
	linter?: string
	dir?: string
}) {
	await runFormatOrLint(Linters, 'lint', options.linter)
}
