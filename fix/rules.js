import * as fs from 'node:fs/promises'
import * as util from 'node:util'
import detectIndent from 'detect-indent'
import { execa } from 'execa'
import * as _ from 'lodash-es'
import dedent from 'dedent'
import { fileExists } from './util.js'
import * as diff from 'diff'
import chalk from 'chalk'

/**
 * @typedef {import('../index.js')} Rule
 */

/**
 * @param {Record<string, null | string>} mapping
 * @returns {AsyncGenerator<Rule>}
 */
export async function* filesMustHaveContent(mapping) {
	for (let file in mapping) {
		const expectedContent = mapping[file]

		if (file.slice(0, 2) === './') {
			file = file.slice(2)
		}

		if (expectedContent === null) {
			if (await fileExists(file)) {
				yield {
					message: [`Expected file "${file}" to not exist`, 'But, found the file'],
					fix: () => fs.rm(file)
				}
			}
		} else {
			if (await fileExists(file)) {
				const content = await fs.readFile(file, 'utf-8')
				if (content !== expectedContent) {
					yield {
						message: `  => Expected file "${file}" to have content:\n---\n${expectedContent}\n---\n  => But, the file has content:\n---\n${content}\n---\n`,
						fix: () => fs.writeFile(file, expectedContent)
					}
				}
			} else {
				yield {
					message: `  => Expected file "${file}" to exist and have content:\n---\n${expectedContent}\n---\n  => But, the file does not exist`,
					fix: () => fs.writeFile(file, expectedContent)
				}
			}
		}
	}
}

/**
 * @param {Record<string, Record<string, unknown>>} mapping
 * @returns {AsyncGenerator<Rule>}
 */
export async function* filesMustHaveShape(mapping) {
	for (let file in mapping) {
		const source = mapping[file]

		if (file.slice(0, 2) === './') {
			file = file.slice(2)
		}

		const content = await fs.readFile(file, 'utf-8')
		const actual = JSON.parse(content)
		const expected = structuredClone(actual)
		customMerge(expected, source)


		if (!util.isDeepStrictEqual(expected, actual)) {
			let difference = ''
			for (const part of diff.diffJson(JSON.stringify(actual, null, 2), JSON.stringify(expected, null, 2))) {
				if (part.added) {
					difference += chalk.green(part.value)
				} else if (part.removed) {
					difference += chalk.red(part.value)
				} else {
					difference += part.value
				}
			}

			yield {
				message: '  ' + dedent`
					=> Expected file "${file}" to have the correct shape:
					---
					${difference.replaceAll('\n', '\n' + '\t'.repeat(5))}
					---
					`,
				fix: () => fs.writeFile(
					file,
					JSON.stringify(expected, null, detectIndent(content).indent || '\t'),
				)
			}
		}
	}
}

/**
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 */
export function customMerge(target, source) {
	for (const key in source) {
		if (Object.hasOwn(target, key)) {
			if (typeof source[key] === 'object' && source[key] !== null) {
				if (Object.hasOwn(source[key], '__delete')) {
					delete target[key]
				} else if (Object.hasOwn(source[key], '__replace')) {
					delete source[key].__replace
					target[key] = source[key]
					customMerge(target[key], source[key])
				} else {
					Object.assign(target[key], source[key])
					customMerge(target[key], source[key])
				}
			} else {
				target[key] = source[key]
				if (typeof target[key] === 'object' && target[key] !== null) {
					customMerge(target[key], source[key])
				}
			}
		} else {
			if (typeof source[key] === 'object' && source[key] !== null) {
				if (Object.hasOwn(source[key], '__delete')) {
				} else if (Object.hasOwn(source[key], '__replace')) {
					target[key] = source[key]
					customMerge(target[key], source[key])
				} else {
					target[key] = {}
					Object.assign(target[key], source[key])
					customMerge(target[key], source[key])
					if (Object.keys(target[key]).length === 0) {
						delete target[key]
					}
				}
			} else {
				target[key] = source[key]
				if (typeof target[key] === 'object' && target[key] !== null) {
					customMerge(target[key], source[key])
				}
			}
		}
	}
}
