import path from 'node:path'
import fs from 'node:fs/promises'
import util from 'node:util'
import chalk from 'chalk'

import { pkgRoot } from './util/util.js'
import { existsSync } from 'node:fs'

async function runRules(/** @type {string} */ ruleDirname) {
    const rulesDir = path.join(pkgRoot(), './rules', ruleDirname)
    for (const ruleFile of await fs.readdir(rulesDir)) {
        const rulesFile = path.join(pkgRoot(), './rules', ruleDirname, ruleFile)
        const module = await import(rulesFile)
        if (module.rule) {
            console.info(chalk.magenta(`Running rule: ${ruleFile}`))
            await module.rule()
        } else {
            console.warn(chalk.warn(`No rule export found in file: ${ruleFile}`))
        }
    }
}

const { values, positionals } = util.parseArgs({
    options: {
        all: {
            type: 'boolean',
            short: 'a',
        },
    }
})
await runRules('all')
if (existsSync('package.json')) {
	await runRules('nodejs')
}
console.log('Done.')
process.exit(1) // Workaround for experimental --experimental-import-meta-resolve issues
