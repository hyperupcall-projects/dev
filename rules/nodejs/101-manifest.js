import * as fs from 'node:fs/promises'
import path from 'node:path';

import { makeRule, pkgRoot } from "../../util/util.js";

export async function rule() {
	await makeRule(
		'package.json must have accurate: description',
		() => {
			return false
		},
		async () => {

		},
	)

	await makeRule(
		'package.json must have accurate: author',
		async () => {
			return (await fs.readFile('.editorconfig', 'utf-8')).length === 0
		},
		async () => {

		},
	)
}
