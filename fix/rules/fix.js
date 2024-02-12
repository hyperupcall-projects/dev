// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import path from 'node:path'
import fs from 'node:fs/promises'
import util from 'node:util'
import chalk from 'chalk'
import toml from '@ltd/j-toml'
import { projectInfo, pkgRoot, print } from '../util.js'
import * as readline from 'node:readline/promises'
import yn from 'yn'

const metadata = {
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
		// TODO: deprecated
		const repositoryLint = projectToml['repository-lint'] || projectToml['dev'] || {}
		return repositoryLint
	})()),
}

const { values, positionals } = util.parseArgs({
	options: {
		yes: {
			type: 'boolean',
		},
		matchers: {
			type: 'string',
		},
		'filter-out': {
			type: 'string',
		},
		'only-run': {
			type: 'string',
		},
		help: {
			type: 'boolean',
			short: 'h',
		},
	},
})
if (values.help) {
	console.info(`fix --filter-out=<FILTER> --matcher=<MATCHER> --only-run<FILTER>= <DIR>:

Flags:
  --help`)
	process.exit(0)
}

if (positionals.length > 0) {
	// @ts-expect-error
	process.chdir(positionals[0] || '.')
}

if (projectInfo?.gitHasRemote) {
	console.log(
		`${chalk.yellow(`Repository:`)} https://github.com/${projectInfo.owner}/${
			projectInfo.name
		}`,
	)
}

const allMatchers = ['ecosystem', 'name', 'organization', 'project']
const matchers = values['matchers']?.split(',') ?? allMatchers
for (const matcher of matchers) {
	if (!allMatchers.includes(matcher)) {
		console.error(`Matcher '${matcher}' not valid`)
		process.exit(1)
	}
}

{
	const filterFn = (/** @type {string} */ longId) => {
		if (values['only-run']) {
			for (const value of values['only-run']?.split(',') ?? []) {
				if (value === longId) {
					return false
				}
			}
			return true
		}

		for (const value of values['filter-out']?.split(',') ?? []) {
			if (value === longId) {
				return true
			}
		}

		return false
	}

	if (matchers.includes('ecosystem')) {
		const rulesDir = path.join(pkgRoot(), 'rules/by-ecosystem')
		for (const group of await fs.readdir(rulesDir)) {
			for (const ruleSetFile of await fs.readdir(path.join(rulesDir, group))) {
				const ruleSetPath = path.join(rulesDir, group, ruleSetFile)
				const ruleSet = ruleSetFile.slice(0, -3)
				await runRuleSet(ruleSetPath, {
					group,
					ruleSet,
					id: `${group}/${ruleSet}`,
					filter: filterFn,
				})
			}
		}
	}

	if (matchers.includes('name')) {
	}

	if (matchers.includes('organizations')) {
		if (projectInfo?.gitHasRemote) {
			const orgsDir = path.join(pkgRoot(), 'rules/by-organization')
			for (const orgName of await fs.readdir(orgsDir)) {
				if (orgName !== projectInfo.owner) {
					continue
				}

				for (const group of await fs.readdir(path.join(orgsDir, orgName))) {
					for (const ruleSetFile of await fs.readdir(
						path.join(orgsDir, orgName, group),
					)) {
						const ruleSetPath = path.join(orgsDir, orgName, group, ruleSetFile)
						const ruleSet = ruleSetFile.slice(0, -3)
						await runRuleSet(ruleSetPath, {
							group,
							ruleSet,
							id: `${group}/${ruleSet}`,
							filter: filterFn,
						})
					}
				}
			}
		}
	}

	if (matchers.includes('url')) {
		await runMatcher('by-url')
	}

	console.log('Done.')
	process.exit(1) // Workaround for experimental --experimental-import-meta-resolve issues
}

/**
 * @param {string} matcher
 */
async function runMatcher(matcher) {
	const matchDir = path.join(pkgRoot(), `rules/${matcher}`)
	for (const groupName of await fs.readdir(matchDir)) {
		for (const group of await fs.readdir(path.join(matchDir, groupName))) {
			for (const ruleSetFile of await fs.readdir(path.join(matchDir, groupName, group))) {
				const ruleSetPath = path.join(matchDir, groupName, group, ruleSetFile)
				const ruleSet = ruleSetFile.slice(0, -3)
				await runRuleSet(ruleSetPath, {
					group,
					ruleSet,
					id: `${group}/${ruleSet}`,
					filter: filterFn,
				})
			}
		}
	}
}

/**
 * @param {string} ruleFile
 * @param {import('../../index.js').RuleSetInfo} info
 */
async function runRuleSet(ruleFile, info) {
	const module = await import(ruleFile)

	if (info.filter(info.id)) {
		print('skip-good', info.id, 'Filtered out')
		return
	}

	if (!module.createRules) {
		print('error', info.id, "ruleSet missing 'createRules' function")
	}

	let rules
	try {
		rules = await module.createRules({ project: projectInfo, metadata })
	} catch (err) {
		print('error', info.id, 'Caught error')
		console.info(err)
		return
	}
	if (!Array.isArray(rules)) {
		print('error', info.id, "ruleSet's 'createRules' function did not return an array")
		return
	}

	for (const rule of rules) {
		if (metadata.ignoredChecks.includes(info.id)) {
			print('skip-good', info.id, 'Included in ignoredChecks')
			continue
		}

		await runRule(rule, {
			group: info.group,
			ruleSet: info.ruleSet,
			rule,
			id: `${info.id}/${rule.id}`,
		})
	}
}

/**
 * @param {import('../../index.js').Rule} rule
 * @param {import('../../index.js').RuleInfo} info
 */
async function runRule(rule, info) {
	const { id, deps, shouldFix, fix } = rule

	if (!shouldFix) {
		throw new TypeError(`Rule '${id}' does not have property: shouldFix`)
	}

	for (const dep of deps ?? []) {
		try {
			let result = await dep()
			if (!result) {
				print('skip-good', info.id, 'Dependencies not satisfied')
				return
			}
		} catch (err) {
			print('error', info.id, 'Caught error from rule dependency check')
			console.info(err)
			return
		}
	}

	let shouldFixRule
	try {
		shouldFixRule = await shouldFix()
	} catch (err) {
		print('error', info.id, 'Caught error from shouldFix()')
		console.info(err)
		return
	}
	if (!shouldFixRule) {
		print('done', info.id, '')
		return
	}

	if (typeof fix !== 'function') {
		print('info', info.id, 'No fix function found')
		return
	}

	async function runFix() {
		try {
			await fix()
			return { applied: true }
		} catch (err) {
			console.error(err)
			return { applied: false }
		}
	}

	if (values.yes) {
		return await runFix()
	} else {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		const input = await rl.question(`${info.id}: Fix? `)
		rl.close()
		if (yn(input)) {
			return await runFix()
		}
	}

	return { applied: false }
}
