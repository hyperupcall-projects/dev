import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { promisify, styleText } from 'node:util'
import * as jsonc from 'jsonc-parser'

const execFileAsync = promisify(execFile)

type RunnerParam = {
	orgDir: string
	orgEntry: Dirent
	repoDir: string
	repoEntry: Dirent
}

type RunnerOptions = {
	ignores?: string[]
}

export async function forEachRepository(
	organizationsDir: string,
	options: RunnerOptions,
	fn: (arg0: RunnerParam) => Promise<void>,
) {
	if (typeof options === 'function') {
		fn = options
		options = {}
	}

	for (const orgEntry of await fs.readdir(organizationsDir, {
		withFileTypes: true,
	})) {
		const orgDir = path.join(orgEntry.parentPath, orgEntry.name)
		if (!orgEntry.isDirectory()) {
			continue
		}

		for (const repoEntry of await fs.readdir(orgDir, {
			withFileTypes: true,
		})) {
			const repoDir = path.join(repoEntry.parentPath, repoEntry.name)
			if (!repoEntry.isDirectory()) {
				continue
			}

			if (Array.isArray(options.ignores)) {
				const shouldSkip = options.ignores.some((ignoreEntry) => {
					if (ignoreEntry === orgEntry.name) {
						return true
					}

					if (ignoreEntry === `${orgEntry.name}/${repoEntry.name}`) {
						return true
					}

					return false
				})

				if (shouldSkip) {
					continue
				}
			}

			await fn({ orgDir, orgEntry, repoDir, repoEntry })
		}
	}
}

export async function getServiceData() {
	const services = [
		{
			name: 'brain.service',
			isUserService: true,
		},
		{ name: 'keymon.service', isUserService: false },
	]

	const data = await Promise.all(
		services.map(async (service) => {
			const [isActive, statusOutput] = await Promise.all([
				execFileAsync('systemctl', [
					...(service.isUserService ? ['--user'] : []),
					'is-active',
					'--quiet',
					service.name,
				])
					.then(() => true)
					.catch(() => false),
				execFileAsync('systemctl', [
					...(service.isUserService ? ['--user'] : []),
					'status',
					service.name,
				])
					.then(({ stdout }) => stdout)
					.catch(() => ''),
			])

			return {
				name: service.name,
				isActive,
				statusOutput,
			}
		}),
	)

	return data
}

export async function mergeYAML(file1: string, file2: string): Promise<string> {
	const { stdout } = await execFileAsync('yq', [
		'eval-all',
		'. as $item ireduce ({}; . * $item)',
		file1,
		file2,
	])
	return stdout
}

export async function mergeTOML(file1: string, file2: string): Promise<string> {
	const mergetomlPy = path.join(import.meta.dirname, 'mergetoml.py')
	const { stdout } = await execFileAsync('uv', ['run', mergetomlPy, file1, file2])
	return stdout
}

export function mergeJSONWithComments(
	originalText: string,
	ast: any,
	newSettings: Record<string, any>,
): string {
	const replacements: Array<{ key: string; oldValue: any; newValue: any }> = []
	const arrayMerges: Array<{ key: string; added: any[] }> = []
	const additions: Array<{ key: string }> = []

	function deepEquals(a: any, b: any): boolean {
		if (a === b) return true
		if (a == null || b == null) return false
		if (typeof a !== typeof b) return false

		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false
			return a.every((val, idx) => deepEquals(val, b[idx]))
		}

		if (typeof a === 'object' && typeof b === 'object') {
			const keysA = Object.keys(a)
			const keysB = Object.keys(b)
			if (keysA.length !== keysB.length) return false
			return keysA.every((key) => deepEquals(a[key], b[key]))
		}

		return false
	}

	const existingJson =
		ast.type === 'JSONObjectExpression' ? jsonASTToValue(ast) : {}

	function deepMerge(
		newObj: Record<string, any>,
		existingObj: any,
		pathPrefix: string[] = [],
	): any {
		const result: Record<string, any> = { ...existingObj }

		for (const [key, newValue] of Object.entries(newObj)) {
			const path = [...pathPrefix, key]
			const pathStr = path.join('.')
			const existingValue = existingObj?.[key]

			if (existingValue === undefined) {
				result[key] = newValue
				additions.push({ key: pathStr })
			} else if (Array.isArray(newValue) && Array.isArray(existingValue)) {
				const elementsToAdd: any[] = []
				for (const newElement of newValue) {
					const exists = existingValue.some((existingElement) =>
						deepEquals(newElement, existingElement),
					)
					if (!exists) {
						elementsToAdd.push(newElement)
					}
				}

				if (elementsToAdd.length > 0) {
					result[key] = [...existingValue, ...elementsToAdd]
					arrayMerges.push({ key: pathStr, added: elementsToAdd })
				}
			} else if (
				typeof newValue === 'object' &&
				newValue !== null &&
				!Array.isArray(newValue) &&
				typeof existingValue === 'object' &&
				existingValue !== null &&
				!Array.isArray(existingValue)
			) {
				result[key] = deepMerge(newValue, existingValue, path)
			} else {
				result[key] = newValue
				replacements.push({
					key: pathStr,
					oldValue: existingValue,
					newValue,
				})
			}
		}

		return result
	}

	const mergedJson = deepMerge(newSettings, existingJson)

	for (const { key } of additions) {
		// console.info(`  ${styleText('green', 'ADD')} ${key}`)
	}
	for (const { key, oldValue, newValue } of replacements) {
		// console.info(
		// 	`  ${styleText('yellow', 'REPLACE')} ${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(
		// 		newValue,
		// 	)}`,
		// )
	}
	for (const { key, added } of arrayMerges) {
		// console.info(
		// 	`  ${styleText('cyan', 'MERGE')} ${key}: added ${added.length} new element(s): ${JSON.stringify(
		// 		added,
		// 	)}`,
		// )
	}

	let output = originalText

	for (const [key, value] of Object.entries(mergedJson)) {
		const edits = jsonc.modify(output, [key], value, {
			formattingOptions: { tabSize: 1, insertSpaces: false },
		})
		output = jsonc.applyEdits(output, edits)
	}

	return output
}

export function overrideFile() {

}

function jsonASTToValue(node: any): any {
	if (!node) return undefined

	switch (node.type) {
		case 'JSONObjectExpression': {
			const obj: Record<string, any> = {}
			if (node.properties) {
				for (const prop of node.properties) {
					if (prop.key?.type === 'JSONLiteral') {
						obj[prop.key.value] = jsonASTToValue(prop.value)
					}
				}
			}
			return obj
		}
		case 'JSONArrayExpression':
			return node.elements ? node.elements.map(jsonASTToValue) : []

		case 'JSONLiteral':
			return node.value

		case 'JSONIdentifier':
			return node.name === 'true'
				? true
				: node.name === 'false'
					? false
					: null

		default:
			return undefined
	}
}
