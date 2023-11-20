import path from 'node:path'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import util from 'node:util'
import chalk from 'chalk'
import toml from '@ltd/j-toml'
import { getProjectInfo, pkgRoot } from './util/util.js'

const projectConfig = {
	ignoredChecks: [],
	...(await (async () => {
		let projectTomlText
		try {
			projectTomlText = await fs.readFile(path.join(process.cwd(), 'project.toml'), 'utf-8')
		} catch (err) {
			return {}
		}

		const projectToml = toml.parse(projectTomlText)
		const repositoryLint = projectToml['repository-lint'] || {}
		return repositoryLint
	})())
}

const project = await getProjectInfo()

async function runRules(/** @type {string} */ ruleDirname) {
	const rulesDir = path.join(pkgRoot(), './rules', ruleDirname)
	for (const ruleFile of await fs.readdir(rulesDir)) {
		const rulesFile = path.join(pkgRoot(), './rules', ruleDirname, ruleFile)
		const module = await import(rulesFile)
		const longId = `${ruleDirname}/${ruleFile}`.slice(0, -3)

		if (module.rule) {
			if (projectConfig.ignoredChecks.includes(longId)) {
				console.info(`${chalk.cyan(`Ignoring:`)} ${longId}`)
			} else {
				console.info(`${chalk.magenta(`Executing:`)} ${longId}`)
				await module.rule({ project, projectConfig })
			}
		} else {
			console.warn(chalk.warn(`No rule export found in file: ${ruleFile}`))
		}
	}
}

const { values, positionals } = util.parseArgs({
	options: {
		help: {
			type: "boolean",
			short: 'h'
		},
		all: {
			type: 'boolean',
			short: 'a',
		},
	}
})

if (values.help) {
	console.log(`repository-lint:

Flags:
  --all
  --help`)
}
console.log(`${chalk.yellow(`Repository:`)} https://github.com/${project.owner}/${project.name}`)
await runRules('any')
await runRules('git')
await runRules('github')
if (existsSync('package.json')) {
	await runRules('nodejs')
}
console.log('Done.')
process.exit(1) // Workaround for experimental --experimental-import-meta-resolve issues
