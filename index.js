import path from 'node:path'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import util from 'node:util'
import chalk from 'chalk'
import toml from '@ltd/j-toml'
import { projectInfo, pkgRoot } from './util/util.js'
import * as readline from 'node:readline/promises'
import yn from 'yn'

const projectConfig = {
	ignoredChecks: [],
	...(await (async () => {
		let projectTomlText
		try {
			projectTomlText = await fs.readFile(
				path.join(process.cwd(), 'project.toml'),
				'utf-8',
			)
		} catch (err) {
			return {}
		}

		const projectToml = toml.parse(projectTomlText)
		const repositoryLint = projectToml['repository-lint'] || {}
		return repositoryLint
	})()),
}


/**
 * @typedef {(arg1: { project: ProjectInfo }) => Promise<{ description: string, shouldFix: () => Promise<boolean>, fix: () => Promise<void>}>} RuleMaker
 */
// TODO: types
async function runRule(rule, longId) {
	const { id, deps, shouldFix, fix } = rule
	if (!shouldFix) throw new TypeError(`Rule '${id}' does not have property: shouldFix`)

	console.info(`${chalk.blue('Rule:')} ${longId}/${id}`)
	for (const dep of (deps ?? [])) {
		try {
			let result = await dep()
			if (!result) {
				console.info(`${chalk.cyan(`Skipping:`)} dependencies not satisfied`)
				return
			}
		} catch (err) {
			console.info(`${chalk.red(`Caught dep Error:`)} ruleset: ${longId}`)
			console.info(err)
			console.info(`${chalk.cyan(`Skipping:`)} ruleset: ${longId}`)
			return
		}
	}

	let willFix
	try {
		willFix = await shouldFix() ?? false
	} catch (err) {
		console.info(err) // TODO
		return { applied: false }
	}
	if (!willFix) {
		// TODO
		return { applied: false }
	}
	if (typeof fix !== 'function') {
		// TODO
		return { applied: false }
	}



	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	const input = await rl.question(`Would you like to fix this? `)
	if (yn(input)) {
		rl.close()
		try {
			await fix()
		} catch (err) {
			console.error(err)
			return { applied: false }
		}

		return { applied: true }
	}
	rl.close()

	return { applied: false }
}

async function runRules(/** @type {string} */ ruleDirname) {
	const rulesDir = path.join(pkgRoot(), './rules', ruleDirname)
	for (const ruleFile of await fs.readdir(rulesDir)) {
		const rulesFile = path.join(pkgRoot(), './rules', ruleDirname, ruleFile)
		const module = await import(rulesFile)
		const longId = `${ruleDirname}/${ruleFile}`.slice(0, -3)

		if (module.createRules) {
			let rules
			try {
				rules = await module.createRules({ project: projectInfo, projectConfig })
			} catch (err) {
				console.info(`${chalk.red(`Caught createRules Error:`)} ruleset: ${longId}`)
				console.info(err)
				console.info(`${chalk.cyan(`Skipping:`)} ruleset: ${longId}`)
				continue
			}
			if (!Array.isArray(rules)) {
				console.info(`${chalk.cyan(`Skipping:`)} ruleset: ${longId}`)
				continue
			}

			for (const rule of rules) {
				if (projectConfig.ignoredChecks.includes(longId)) {
					console.info(`${chalk.cyan(`Ignoring:`)} ${longId}`)
					continue
				}

				await runRule(rule, longId)
			}
		} else {
			console.warn(chalk.warn(`No rule export found in file: ${ruleFile}`))
		}
	}
}

const { values, positionals } = util.parseArgs({
	options: {
		help: {
			type: 'boolean',
			short: 'h',
		},
		all: {
			type: 'boolean',
			short: 'a',
		},
	},
})

if (values.help) {
	console.log(`repository-lint:

Flags:
  --all
  --help`)
}
console.log(
	`${chalk.yellow(`Repository:`)} https://github.com/${projectInfo.owner}/${projectInfo.name}`,
)
await runRules('any')
await runRules('git')
await runRules('github')
if (existsSync('package.json')) {
	await runRules('nodejs')
}
if (existsSync(path.join(pkgRoot(), `rules/org-${projectInfo.owner}`))) {
	await runRules(`org-${projectInfo.owner}`)
}
console.log('Done.')
process.exit(1) // Workaround for experimental --experimental-import-meta-resolve issues
