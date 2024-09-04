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
 * @property {boolean} isOutOfDate
 * @property {string} gitRef
 * @property {string[]} versions
 *
 * @typedef {Object} Ctx
 * @property {string} devDir
 * @property {string} repositoryDir
 * @property {Project} project
 * @property {Project[]} projects
 *
 * @typedef {'main' | 'update-version'} Screen
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

let ignoreKeystrokes = false
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
	await render('')

	process.stdin.on('data', async (data) => {
		if (ignoreKeystrokes) {
			return
		}

		const char = data.toString()
		await render(char)
	})
}

let /** @type {Screen} */ currentScreen = 'main'
async function render(/** @type {string} */ char) {
	if (currentScreen === 'main') {
		await renderMainScreen(char)
	} else if (currentScreen === 'update-version') {
		await renderUpdateVersionScreen(char)
	}
}

async function renderMainScreen(/** @type {string} */ char) {
	let currentProject = ctx.projects.indexOf(ctx.project)

	if (char === '\x1B' || char === 'q') {
		process.exit()
	} else if (char === 'j') {
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
	} else if (char === 'f') {
		await updateProjectData()
	} else if (char === 'v') {
		currentScreen = 'update-version'
		await render('')
		return
	}

	const sep = '='.repeat(process.stdout.columns)
	const nameColLen = 13
	const clonedColLen = 8
	const installedColLen = 10
	const refColLen = 9
	const latestVersionColLen = 18

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
		process.stdout.write(`${ctx.projects[i].isOutOfDate ? 'NO' : 'YES'}`)
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
		  - f: Fetch refs
		  - v: Switch version/ref of repository
		  - q/esc: Exit program\n`)
	process.stdout.write(`${sep}\n`)
}

let currentVersion = 0
async function renderUpdateVersionScreen(/** @type {string} */ char) {
	let currentProject = ctx.projects.indexOf(ctx.project)
	const name =  path.basename(new URL(ctx.projects[currentProject].url).pathname)

	if (char === '\x1B' || char === 'q') {
		process.exit()
	} else if (char === 'j') {
		currentVersion = Math.min(ctx.projects[currentProject].versions.length - 1, currentVersion + 1)
	} else if (char === 'k') {
		currentVersion = Math.max(0, currentVersion - 1)
	} else if (char === '\x0D') {
		ignoreKeystrokes = true
		process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
		const ref = ctx.projects[currentProject].versions[currentVersion]
		await execa`git -C ${path.join(ctx.repositoryDir, name)} switch --detach refs/tags/${ref}`
		ignoreKeystrokes = false
		currentScreen = 'main'
		await render('')
		return
	} else if (char === 'v' || char === '\x7F') {
		currentScreen = 'main'
		await render('')
		return
	}

	const sep = '='.repeat(process.stdout.columns)
	process.stdout.write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 0))
	process.stdout.write(`REPOSITORY: ${name}\n`)
	for (let i = 0; i < ctx.projects[currentProject].versions.length; ++i) {
		const version = ctx.projects[currentProject].versions[i]
		process.stdout.write(`[${i === currentVersion ? 'x' : ' '}] ${version}\n`)
	}
	process.stdout.write(`${sep}\n`)
	process.stdout.write(dedent`
		CONTROLS
		  - j/k: Move up/down
		  - Enter: Select version
		  - v/backspace: Go back
		  - q/esc: Exit program\n`)
	process.stdout.write(`${sep}\n`)
}


async function updateProjectData() {
	let projectExists = await Promise.all(ctx.projects.map((project) => {
		const name =  path.basename(new URL(project.url).pathname)
		const dir = path.join(ctx.repositoryDir, name)
		return fileExists(dir)
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

		const [{ stdout: currentTag }, { stdout: latestTag }] = await Promise.all([
			await execa`git -C ${dir} tag --points-at HEAD`,
			await execa`git -C ${dir} describe --tags --abbrev=0`.catch(() => ({ stdout: '' }))
		])
		if (currentTag) {
			if (currentTag === latestTag) {
				ctx.projects[i].isOutOfDate = false
				return currentTag
			} else {
				ctx.projects[i].isOutOfDate = true
				return currentTag
			}
		} else {
			const [{ stdout: localRef }, { stdout: remoteRef }, { stdout: remoteRefFormatted }] = await Promise.all([
				await execa`git -C ${dir} rev-parse --short HEAD`,
				await execa`git -C ${dir} rev-parse --short @{u}`,
				await execa`git -C ${dir} rev-parse --abbrev-ref @{u}`.catch(() => ({stdout: ''}))
			])

			if (localRef === remoteRef) {
				ctx.projects[i].isOutOfDate = false
				return remoteRefFormatted
			} else {
				ctx.projects[i].isOutOfDate = true
				return localRef
			}
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
		const [{ stdout }, {stdout: remoteRef }] = await Promise.all([
			execa`git -C ${dir} tag --list`,
			execa`git -C ${dir} rev-parse --abbrev-ref @{u}`.catch(() => ({ stdout: ''}))
		])

		const tags = stdout.split('\n')
		const versions = tags.filter((tag) => tag.startsWith('v')).sort((a, b) => semver.gt(a, b) ? -1 : semver.lt(a, b) ? 1 : 0)
		return [remoteRef].concat(versions)
	}))
	for (let i = 0; i < ctx.projects.length; ++i) {
		ctx.projects[i].versions = projectVersions[i]
	}

	for (let i = 0; i < ctx.projects.length; ++i) {
		ctx.projects[i].isInstalled = (await ctx.projects[i]?.installed?.()) ?? false
	}
}

async function waitOnConfirmInput() {
	process.stdout.write('PRESS ENTER TO CONTINUE...\n')
	await new Promise((resolve, reject) => {
		process.stdin
			.once('data', (data) => {
				const char = data.toString()

				if (char === '\x0D') {
					resolve(undefined)
				}
			})
			.on('error', reject)
	})
}
