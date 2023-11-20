import * as fs from 'node:fs/promises'
import path from 'node:path';

import { makeRule, pkgRoot } from "../../util/util.js";

export async function rule() {
	await makeRule(() => {
		return {
			description: 'package.json must have accurate: description',
			async shouldFix() {
				return false
			},
			async fix() {

			}
		}
	})

	await makeRule(() => {
		return {
			description: 'package.json must have accurate: author',
			async shouldFix() {
				return false
			},
			async fix() {

			}
		}
	})
}
