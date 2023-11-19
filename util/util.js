import * as readline from 'node:readline/promises'
import * as path from 'node:path'
import yn from 'yn'
import chalk from 'chalk'

/**
 * @param {string} packageName
 * @returns string
 */
export function pkgRoot(packageName) {
	if (packageName === void 0) {
		return path.dirname(path.dirname(new URL(import.meta.url).pathname))
	} else {
		return path.dirname(new URL(import.meta.resolve(packageName)).pathname)
	}
}

/**
 * @param {() => Promise<{ description: string, shouldFix: () => Promise<boolean>, fix: () => Promise<void>}>} ruleMaker
 */
export async function makeRule(ruleMaker) {
	const { description, shouldFix, fix } = await ruleMaker()
	if (!description) throw new TypeError(`Parameter not passed: description`)
	if (!shouldFix) throw new TypeError(`Parameter not passed: shouldFix`)

	if (await shouldFix()) {
		console.info(`ASSERTION FAILED: ${description}`)
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		const input = await rl.question(`Would you like to fix this? `)
		if (yn(input)) {
			if (typeof fix === 'function') {
				await fix()
			} else {
				console.log(chalk.red(`No fix available`))
			}

		}
	}
}
