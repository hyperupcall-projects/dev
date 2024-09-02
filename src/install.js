import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import tty from 'node:tty'
import nutil from 'node:util'

import ansiEscapes from 'ansi-escapes';
import chalk from 'chalk'
import dedent from 'dedent'
import { fileExists } from '../config/common.js'
import { execa } from 'execa'
import semver from 'semver'

/**
 * @typedef {Object} Project
 * @property {string} url
 * @property {string} install
 * @property {string} uninstall
 * @property {() => Promise<boolean>} installed
 * @property {boolean} isCloned
 * @property {boolean} isInstalled
 * @property {string} gitRef
 * @property {string[]} versions
 *
 * @typedef {Object} Ctx
 * @property {string} devDir
 * @property {string} repositoryDir
 * @property {Project} project
 * @property {Project[]} projects
 */

/** @type {Ctx} */
const ctx = {
	devDir: path.join(os.homedir(), '.dev'),
	repositoryDir: path.join(os.homedir(), '.dev/repositories'),
	project: null,
	projects: [
		{
			url: 'https://github.com/fox-incubating/hub',
			install: dedent`
				pnpm install
				pnpm build
				make install
			`,
			uninstall: dedent`
				make uninstall
			`,
			async installed() {
				try {
					const { stdout } = await execa`systemctl --user is-enabled hub.service`
					return stdout === 'enabled'
				} catch (err) {
					return false
				}
			}
		},
		// {
		// 	url: 'https://github.com/fox-incubating/wo',
		// 	install: dedent`
		// 		cargo install --path .
		// 	`,
		// 	uninstall: dedent`
		// 		cargo uninstall --path .
		// 	`,
		// 	async installed() {
		// 		try {
		// 			await execa({ shell: true })`command -v wo`
		// 			return true
		// 		} catch (err) {
		// 			return false
		// 		}
		// 	}
		// },
		{
			url: 'https://github.com/fox-projects/pick-sticker',
			install: dedent`
				# ./bake collect
				./bake download
				./bake generate_sizes
				./bake browsec
			`,
			uninstall: '',
		},
		// {
		// 	url: 'https://github.com/hyperupcall/autoenv'
		// },
		// {
		// 	url: 'https://github.com/bash-bastion/basalt',
		// 	install: dedent`
		// 		./scripts/install.sh | sh`,
		// 	uninstall: '',
		// 	async installed() {
		// 		try {
		// 			await execa({ shell: true })`command -v basalt`
		// 			return true
		// 		} catch (err) {
		// 			return false
		// 		}
		// 	}
		// },
		{
			url: 'https://github.com/version-manager/woof',
			install: dedent``,
			uninstall: '',
			async installed() {
				try {
					await execa({ shell: true })`command -v woof`
					return true
				} catch (err) {
					return false
				}
			}
		}
	]
}
ctx.project = ctx.projects[0]

export async function run(/** @type {string[]} */ args) {
	await fs.mkdir(ctx.devDir, { recursive: true })
	await fs.mkdir(ctx.repositoryDir, { recursive: true })

	process.stdin.setRawMode(true)
	process.stdout.write(ansiEscapes.cursorSavePosition)
	process.stdout.write(ansiEscapes.cursorHide) // TODO: Not working
	process.stdout.write(ansiEscapes.enterAlternativeScreen)
	process.stdin.on('end', () => {
		process.stdout.write(ansiEscapes.cursorRestorePosition)
		process.stdout.write(ansiEscapes.cursorShow)
		process.stdout.write(ansiEscapes.exitAlternativeScreen)
	})

	await updateProjectData()
	await renderMenu()

	let ignoreKeystrokes = false
	process.stdin.on('data', async (data) => {
		if (ignoreKeystrokes) {
			return
		}

		const char = data.toString()
		let currentProject = ctx.projects.indexOf(ctx.project)

		if (char === '\x1B' || char === 'q') {
			process.exit()
		}

		if (char === 'j') {
			currentProject = Math.min(ctx.projects.length - 1, currentProject + 1)
			ctx.project = ctx.projects[currentProject]
		} else if (char === 'k') {
			currentProject = Math.max(0, currentProject - 1)
			ctx.project = ctx.projects[currentProject]
		} else if (char === 'c') {
			if (ctx.project.isCloned) {
				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				process.stdout.write('Repository already cloned...\n')
			} else {
				const name =  path.basename(new URL(ctx.projects[currentProject].url).pathname)
				const dir = path.join(ctx.repositoryDir, name)

				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				ignoreKeystrokes = true
				await execa({ stdio: 'inherit' })`git clone ${ctx.projects[currentProject].url} ${dir}`
				ignoreKeystrokes = false
				await updateProjectData()
			}
			await waitOnConfirmInput()
		} else if (char === 'r') {
			if (ctx.project.isCloned) {
				const name =  path.basename(new URL(ctx.projects[currentProject].url).pathname)
				const dir = path.join(ctx.repositoryDir, name)

				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				await fs.rm(dir, { recursive: true })
				await updateProjectData()
			} else {
				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				process.stdout.write('Repository already removed...\n')
			}
			await waitOnConfirmInput()
		} else if (char === 'i') {
			if (ctx.project.isCloned) {
				const name =  path.basename(new URL(ctx.projects[currentProject].url).pathname)
				const dir = path.join(ctx.repositoryDir, name)

				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				const scriptFile = path.join(os.tmpdir(), `dev-${crypto.randomUUID()}.sh`)
				await fs.writeFile(scriptFile, ctx.projects[currentProject].install)
				ignoreKeystrokes = true
				await execa({ stdio: 'inherit', cwd: dir })`bash -eo pipefail ${scriptFile}`
				ignoreKeystrokes = false
				await updateProjectData()
			} else {
				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				process.stdout.write('Repository does not exist...\n')
			}
			await waitOnConfirmInput()
		} else if (char === 'u') {
			if (ctx.project.isCloned) {
				const name =  path.basename(new URL(ctx.projects[currentProject].url).pathname)
				const dir = path.join(ctx.repositoryDir, name)

				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				const scriptFile = path.join(os.tmpdir(), `dev-${crypto.randomUUID()}.sh`)
				await fs.writeFile(scriptFile, ctx.projects[currentProject].uninstall)
				ignoreKeystrokes = true
				await execa({ stdio: 'inherit', cwd: dir })`bash -eo pipefail ${scriptFile}`
				ignoreKeystrokes = false
				await updateProjectData()
			} else {
				process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
				process.stdout.write('Repository does not exist...\n')
			}
			await waitOnConfirmInput()
		} else if (char === 'v') {
			process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
			process.stdout.write('Not implemented...\n')
			await waitOnConfirmInput()
		}

		await renderMenu()
	})
}

async function updateProjectData() {
	let projectExists = await Promise.all(ctx.projects.map((project) => {
		const name =  path.basename(new URL(project.url).pathname)
		const dir = path.join(ctx.repositoryDir, name)
		return fileExists(dir, 'utf-8')
	}))
	for (let i = 0; i < ctx.projects.length; ++i) {
		ctx.projects[i].isCloned = projectExists[i]
	}

	let projectRefs = await Promise.all(ctx.projects.map(async (project, i) => {
		if (!projectExists[i]) {
			return ''
		}

		const name =  path.basename(new URL(project.url).pathname)
		const dir = path.join(ctx.repositoryDir, name)

		const { stdout: tag } = await execa`git -C ${dir} tag --points-at HEAD`
		if (tag) {
			return tag
		} else {
			return 'HEAD'
		}
	}))
	for (let i = 0; i < ctx.projects.length; ++i) {
		ctx.projects[i].gitRef = projectRefs[i]
	}

	let projectVersions = await Promise.all(ctx.projects.map(async (project, i) => {
		if (!projectExists[i]) {
			return []
		}

		const name =  path.basename(new URL(project.url).pathname)
		const dir = path.join(ctx.repositoryDir, name)

		await execa`git -C ${dir} fetch --all`
		const { stdout } = await execa`git -C ${dir} tag --list`

		const tags = stdout.split('\n')
		const versions = tags.filter((tag) => tag.startsWith('v')).sort((a, b) => semver.lt(a, b))
		return versions
	}))
	for (let i = 0; i < ctx.projects.length; ++i) {
		ctx.projects[i].versions = projectVersions[i]
	}

	for (let i = 0; i < ctx.projects.length; ++i) {
		ctx.projects[i].isInstalled = (await ctx.projects[i]?.installed?.()) ?? false
	}
}

async function renderMenu() {
	const sep = '='.repeat(process.stdout.columns)
	const nameColLen = 13
	const clonedColLen = 8
	const installedColLen = 10
	const refColLen = 6
	const latestVersionColLen = 18
	const currentProject = ctx.projects.indexOf(ctx.project)

	process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
	process.stdout.write(`${sep}\n`)
	process.stdout.write(`    ${'Name'.padEnd(nameColLen)} ${'Cloned'.padEnd(clonedColLen)}`)
	process.stdout.write(`${'Installed'.padEnd(installedColLen)} ${'Ref'.padEnd(refColLen)}`)
	process.stdout.write(`${'Latest Version?'.padEnd(latestVersionColLen)}\n`)
	process.stdout.write(`${sep}\n`)
	for (let i = 0; i < ctx.projects.length; ++i) {
		const name = path.basename(new URL(ctx.projects[i].url).pathname)

		process.stdout.write(`[${i === currentProject ? 'x' : ' '}] `)
		process.stdout.write(`${name.padEnd(nameColLen)} ${(ctx.projects[i].isCloned ? 'YES' : 'NO').padEnd(clonedColLen)}`)
		process.stdout.write(`${(ctx.projects[i].isInstalled ? 'YES' : 'NO').padEnd(installedColLen)} ${ctx.projects[i].gitRef.padEnd(refColLen)}`)

		process.stdout.write('\n')
	}
	process.stdout.write(`${sep}\n`)
	process.stdout.write(dedent`
		CONTROLS
		  - j/k: Move up/down
		  - c: Clone repository
		  - r: Remove repository
		  - i: Install repository
		  - u: Uninstall repository
		  - v: Switch version/ref of repository
		  - q/esc: Exit program\n`)
	process.stdout.write(`${sep}\n`)
}

async function waitOnConfirmInput() {
	process.stdout.write('PRESS ENTER TO CONTINUE...\n')
	await new Promise((resolve, reject) => {
		process.stdin
			.once('data', (data) => {
				const char = data.toString()

				if (char === '\x0D') {
					resolve()
				}
			})
			.on('error', reject)
	})
}
