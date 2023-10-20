import path from 'node:path'
import fs from 'node:fs/promises'
import chalk from 'chalk'

import { pkgRoot } from './util/util.js'

async function runRules(/** @type {string} */ ruleDirname) {
    const rulesDir = path.join(pkgRoot(), './rules', ruleDirname)
    for (const ruleFile of await fs.readdir(rulesDir)) {
        const rulesFile = path.join(pkgRoot(), './rules', ruleDirname, ruleFile)
        const module = await import(rulesFile)
        if (module.rule) {
            console.info(chalk.magenta(`Running rule: ${ruleFile}`))
            await module.rule()
        } else {
            console.warn(chalk.warn(`No rule found in file: ${ruleFile}`))
        }
    }
}

await runRules('all')
await runRules('nodejs')
console.log('Done.')
process.exit(1) // Workaround for experimental --experimental-import-meta-resolve
