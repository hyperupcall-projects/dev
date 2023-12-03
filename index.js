// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import path from 'node:path'
import fs from 'node:fs/promises'
import util from 'node:util'
import chalk from 'chalk'
import toml from '@ltd/j-toml'
import { projectInfo, pkgRoot, fileExists } from './util/util.js'
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

const { values, positionals } = util.parseArgs({
	options: {
		filterOut: {
			type: 'string',
		},
		onlyRun: {
			type: 'string',
		},
		help: {
			type: 'boolean',
			short: 'h',
		},
	},
})
if (values.help) {
	console.log(`repository-lint <DIR>:

Flags:
  --help`)
}

if (positionals.length > 0) {
	process.chdir(positionals[0] || '.')
}

if (projectInfo?.gitHasRemote) {
	console.log(
		`${chalk.yellow(`Repository:`)} https://github.com/${projectInfo.owner}/${
			projectInfo.name
		}`,
	)
}

{
	const filterFn = (/** @type {string} */ longId) => {
		if (values.onlyRun) {
			for (const value of values.onlyRun?.split(',') ?? []) {
				if (value === longId) {
					return false
				}
			}
			return true
		}

		for (const value of values.filterOut?.split(',') ?? []) {
			if (value === longId) {
				return true
			}
		}

		return false
	}

	const rulesDir = path.join(pkgRoot(), 'rules')
	for (const ruleName of await fs.readdir(rulesDir)) {
		for (const subRuleName of await fs.readdir(path.join(rulesDir, ruleName))) {
			const finalDirpath = path.join(rulesDir, ruleName, subRuleName)
			await runRules(finalDirpath, {
				ruleName,
				subRuleName,
				filter: filterFn,
			})
		}
	}

	if (projectInfo?.gitHasRemote) {
		const orgRulesDir = path.join(pkgRoot(), 'org-rules')
		for (const orgName of await fs.readdir(orgRulesDir)) {
			if (orgName !== projectInfo.owner) {
				continue
			}

			for (const ruleName of await fs.readdir(path.join(orgRulesDir, orgName))) {
				for (const subRuleName of await fs.readdir(
					path.join(orgRulesDir, orgName, ruleName),
				)) {
					const finalDirpath = path.join(orgRulesDir, orgName, ruleName, subRuleName)
					await runRules(finalDirpath, {
						ruleName,
						subRuleName,
						filter: filterFn,
					})
				}
			}
		}
	}

	console.log('Done.')
	process.exit(1) // Workaround for experimental --experimental-import-meta-resolve issues
}

/**
 * @typedef {(arg1: { project: typeof projectInfo }) => Promise<{ description: string, shouldFix: () => Promise<boolean>, fix: () => Promise<void>}>} RuleMaker
 */
async function runRule(rule, longId) {
	const { id, deps, shouldFix, fix } = rule
	if (!shouldFix) throw new TypeError(`Rule '${id}' does not have property: shouldFix`)

	console.info(`${chalk.blue('Rule:')} ${longId}/${id}`)
	for (const dep of deps ?? []) {
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
		willFix = (await shouldFix()) ?? false
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

/**
 * @param {string} ruleFile
 * @param {{ ruleName: string, subRuleName: string, filter: (longId: string) => boolean }} options
 */
async function runRules(ruleFile, options) {
	const module = await import(ruleFile)
	const longId = `${options.ruleName}/${options.subRuleName}`.slice(0, -3)
	if (options.filter(longId)) {
		console.log(`${chalk.red('Filtering out:')} ${longId}`)
		return
	}

	if (!module.createRules) {
		console.warn(chalk.red(`No rule export found in file: ${ruleFile}`))
	}
	let rules
	try {
		rules = await module.createRules({ project: projectInfo, projectConfig })
	} catch (err) {
		console.info(`${chalk.red(`Caught createRules Error:`)} ruleset: ${longId}`)
		console.info(err)
		console.info(`${chalk.cyan(`Skipping:`)} ruleset: ${longId}`)
		return
	}
	if (!Array.isArray(rules)) {
		console.info(`${chalk.cyan(`Skipping:`)} ruleset: ${longId}`)
		return
	}

	for (const rule of rules) {
		if (projectConfig.ignoredChecks.includes(longId)) {
			console.info(`${chalk.cyan(`Ignoring:`)} ${longId}`)
			continue
		}

		await runRule(rule, longId)
	}
}
