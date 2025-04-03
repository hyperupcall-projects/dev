import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { TsConfigJson } from 'type-fest'
import type { Issues } from '#types'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveShape,
	filesMustHaveContent,
} from '#common'

export const issues: Issues = async function* issues({ project }) {
	const configs = await Promise.all([
		fs
			.readFile('tsconfig.json', 'utf-8')
			.then((value) => {
				return (JSON.parse(value) as TsConfigJson) || {}
			})
			.catch((err: NodeJS.Error) => {
				if (err.code !== 'ENOENT') throw err
			}),
		fs
			.readFile('jsconfig.json', 'utf-8')
			.then((value) => {
				return (JSON.parse(value) as TsConfigJson) || {}
			})
			.catch((err: NodeJS.Error) => {
				if (err.code !== 'ENOENT') throw err
			}),
	])

	let values: string[] = []
	for (const config of configs) {
		if (!config) continue

		values.push(config.compilerOptions?.module ?? '')
		values.push(config.compilerOptions?.moduleResolution ?? '')
		values.push(config.compilerOptions?.newLine ?? '')
		values.push(config.compilerOptions?.target ?? '')
		values = values.concat(config.compilerOptions?.lib ?? [])
	}

	for (const value of values) {
		if (!value) continue

		if (value.toLowerCase() !== value) {
			yield {
				message: 'Field values must be lowercase',
			}
		}
	}
}
