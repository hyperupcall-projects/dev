import * as readline from 'node:readline/promises'
import * as path from 'node:path'
import yn from 'yn'

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
 * @param {string} description
 * @param {() => Promise<boolean>} shouldFixFn
 * @param {() => Promise<void>} fixerFn
 */
export async function makeRule(description, shouldFixFn, fixerFn) {
    const shouldFix = await shouldFixFn()
    if (shouldFix) {
		console.info(`ASSERTION FAILED: ${description}`)
        const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
        const input = await rl.question(`Would you like to fix this? `)
        if (yn(input)) {
            await fixerFn()
        }
    }

}
