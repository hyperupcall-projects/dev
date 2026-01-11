import * as fs from 'node:fs/promises'
import { fileExists } from '#common'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	const CmakeListsText = 'CMakeLists.txt'

	if (!(await fileExists(CmakeListsText))) {
		return
	}

	const content = await fs.readFile(CmakeListsText, 'utf-8')

	if (!/^[ \t]*cmake_minimum_required[ \t]*\([ \t]*VERSION[ \t]+/i.test(content)) {
		yield {
			message: [
				`Expected file "${CmakeListsText}" to include cmake_minimum_required(VERSION ...)`,
				'But, it could not be found',
			],
		}
	}

	if (!/^[ \t]*project[ \t]*\(/im.test(content)) {
		yield {
			message: [
				`Expected file "${CmakeListsText}" to include project(...)`,
				'But, it could not be found',
			],
		}
	}

	if (!/^[ \t]*set[ \t]*\([ \t]*CMAKE_EXPORT_COMPILE_COMMANDS[ \t]+ON[ \t]*\)/im.test(content)) {
		yield {
			message: [
				`Expected file "${CmakeListsText}" to include set(CMAKE_EXPORT_COMPILE_COMMANDS ON)`,
				'But, found no CMAKE_EXPORT_COMPILE_COMMANDS setting',
			],
		}
	}

	if (!/^[ \t]*set[ \t]*\([ \t]*CMAKE_COLOR_DIAGNOSTICS[ \t]+ON[ \t]*\)/im.test(content)) {
		yield {
			message: [
				`Expected file "${CmakeListsText}" to include set(CMAKE_COLOR_DIAGNOSTICS ON)`,
				'But, found no CMAKE_COLOR_DIAGNOSTICS setting',
			],
		}
	}
}
