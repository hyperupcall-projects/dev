import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import tty from 'node:tty'
import nutil from 'node:util'

import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import dedent from 'dedent'
import { fileExists } from '../config/common.js'
import { execa } from 'execa'
import semver from 'semver'

/**
 * @typedef {Object} ProjectData
 * @property {boolean} isCloned
 * @property {boolean} isInstalled
 * @property {boolean} isOutOfDate
 * @property {string} gitRef
 * @property {string[]} versions
 *
 * @typedef {Object} Project
 * @property {string} name
 * @property {string} url
 * @property {string} install
 * @property {string} uninstall
 * @property {() => Promise<boolean>} installed
 * @property {ProjectData} [data]
 */

/** @type {Project[]} */
const Projects = [
	{
		name: 'hub',
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
		},
	},
	{
		name: 'dev',
		url: 'https://github.com/fox-incubating/dev',
		install: dedent`
			pnpm install
			ln -sf "$PWD/bin/dev.js" ~/.local/bin/dev
	`,
		uninstall: dedent`
			rm -f ~/.local/bin/dev
			pnpm uninstall
	`,
		async installed() {
			return await fileExists(path.join(os.homedir(), '.local/bin/dev'))
		},
	},
	{
		name: 'ten',
		url: 'https://github.com/fox-incubating/ten',
		install: dedent`
			pnpm install
			ln -sf "$PWD/bin/ten.js" ~/.local/bin/ten
	`,
		uninstall: dedent`
			rm -f ~/.local/bin/ten
			pnpm uninstall
	`,
		async installed() {
			return await fileExists(path.join(os.homedir(), '.local/bin/ten'))
		},
	},
	{
		name: 'pick-sticker',
		url: 'https://github.com/fox-projects/pick-sticker',
		install: dedent`
			# ./bake collect
			./bake download
			./bake generate_sizes
			./bake browsec
	`,
		uninstall: '',
		async installed() {
			return false
		},
	},
	{
		name: 'woof',
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
		},
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
]

/**
 * @typedef {'main' | 'update-version'} Screen
 */
const Ctx = {
	devDir: path.join(os.homedir(), '.dev'),
	repositoryDir: path.join(os.homedir(), '.dev/repositories'),
	currentProject: 'hub',
}

let ignoreKeystrokes = false
export async function run(/** @type {string[]} */ args) {
	await fs.mkdir(Ctx.devDir, { recursive: true })
	await fs.mkdir(Ctx.repositoryDir, { recursive: true })

	process.stdin.setRawMode(true)
	process.stdout.write(ansiEscapes.cursorSavePosition)
	process.stdout.write(ansiEscapes.cursorHide)
	process.stdout.write(ansiEscapes.enterAlternativeScreen)
	process.on('exit', () => {
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
	const project = Projects.find((project) => project.name === Ctx.currentProject)
	if (!project?.data) {
		throw new Error(`Failed to find project with name: \"${Ctx.currentProject}\"`)
	}

	if (char === '\x1B' || char === 'q') {
		process.stdout.write(ansiEscapes.cursorRestorePosition)
		process.stdout.write(ansiEscapes.cursorShow)
		process.stdout.write(ansiEscapes.exitAlternativeScreen)
		process.exit()
	} else if (char === 'j') {
		const idx = Projects.findIndex((project) => project.name === Ctx.currentProject)
		const newIdx = Math.min(Projects.length - 1, idx + 1)
		Ctx.currentProject = Projects[newIdx].name
	} else if (char === 'k') {
		const idx = Projects.findIndex((project) => project.name === Ctx.currentProject)
		const newIdx = Math.max(0, idx - 1)
		Ctx.currentProject = Projects[newIdx].name
	} else if (char === 'c') {
		if (project.data.isCloned) {
			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			process.stdout.write('Repository already cloned...\n')
		} else {
			const dir = path.join(Ctx.repositoryDir, project.name)

			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			ignoreKeystrokes = true
			await execa({
				stdio: 'inherit',
			})`git clone ${project.url} ${dir}`
			ignoreKeystrokes = false
			await updateProjectData()
		}
		await waitOnConfirmInput()
	} else if (char === '\x7F') {
		if (project.data.isCloned) {
			const dir = path.join(Ctx.repositoryDir, project.name)

			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			process.stdout.write(
				`REMOVING DIRECTORY: ${path.join(Ctx.repositoryDir, project.name)}\n`,
			)
			process.stdout.write(`Exit with "q/esc" to abort in less than 5 seconds\n`)
			await new Promise((resolve, reject) => {
				setTimeout(async () => {
					try {
						await fs.rm(dir, { recursive: true })
						process.stdout.write('Done. Updating project data...\n')
						await updateProjectData()
						await waitOnConfirmInput()
					} catch (err) {
						reject(err)
					} finally {
						resolve(undefined)
					}
				}, 5000)
			})
		} else {
			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			process.stdout.write('Repository already removed...\n')
			await waitOnConfirmInput()
		}
	} else if (char === 'i') {
		if (project.data.isCloned) {
			const dir = path.join(Ctx.repositoryDir, project.name)

			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			const scriptFile = path.join(os.tmpdir(), `dev-${crypto.randomUUID()}.sh`)
			await fs.writeFile(scriptFile, project.install)
			ignoreKeystrokes = true
			await execa({ stdio: 'inherit', cwd: dir })`bash -eo pipefail ${scriptFile}`
			ignoreKeystrokes = false
			await updateProjectData()
		} else {
			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			process.stdout.write('Repository does not exist...\n')
		}
		await waitOnConfirmInput()
	} else if (char === 'u') {
		if (project.data.isCloned) {
			const dir = path.join(Ctx.repositoryDir, project.name)

			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			const scriptFile = path.join(os.tmpdir(), `dev-${crypto.randomUUID()}.sh`)
			await fs.writeFile(scriptFile, project.uninstall)
			ignoreKeystrokes = true
			await execa({ stdio: 'inherit', cwd: dir })`bash -eo pipefail ${scriptFile}`
			ignoreKeystrokes = false
			await updateProjectData()
		} else {
			process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
			process.stdout.write('Repository does not exist...\n')
		}
		await waitOnConfirmInput()
	} else if (char === 'r') {
		process.stdout.write('LOADING...\n')
		await updateProjectData()
	} else if (char === 'v') {
		currentScreen = 'update-version'
		await render('')
		return
	}

	const sep = '='.repeat(process.stdout.columns)
	const nameColLen = 13
	const clonedColLen = 8
	const installedColLen = 11
	const currentRef = 14
	const latestRef = 14

	process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
	process.stdout.write(`${sep}\n`)
	process.stdout.write(
		'    ' +
			'Name'.padEnd(nameColLen) +
			'Cloned'.padEnd(clonedColLen) +
			'Installed'.padEnd(installedColLen) +
			'Current Ref'.padEnd(currentRef) +
			'Latest Ref'.padEnd(latestRef) +
			'\n',
	)
	process.stdout.write(`${sep}\n`)
	for (const project of Projects) {
		if (!project?.data) {
			throw new Error(`Project does not have data attached: \"${project.name}\"`)
		}

		process.stdout.write(`[${project.name === Ctx.currentProject ? 'x' : ' '}] `)
		process.stdout.write(
			project.name.padEnd(nameColLen) +
				(project.data.isCloned ? 'YES' : 'NO').padEnd(clonedColLen),
		)
		process.stdout.write(
			(project.data.isInstalled ? 'YES' : 'NO').padEnd(installedColLen) +
				project.data.gitRef.padEnd(currentRef),
		)
		process.stdout.write(project.data.isOutOfDate ? 'NO' : 'YES')
		process.stdout.write('\n')
	}
	process.stdout.write(`${sep}\n`)
	process.stdout.write(dedent`
		CONTROLS
		  - j/k: Move up/down
		  - c: Clone repository
		  - backspace: Remove repository
		  - i: Install repository
		  - u: Uninstall repository
		  - r: Refresh refs
		  - v: Switch version/ref of repository
		  - q/esc: Exit program\n`)
	process.stdout.write(`${sep}\n`)
}

let currentVersion = 0
async function renderUpdateVersionScreen(/** @type {string} */ char) {
	const project = Projects.find((project) => project.name === Ctx.currentProject)
	if (!project?.data) {
		throw new Error(`Failed to find project with name: \"${Ctx.currentProject}\"`)
	}

	if (char === '\x1B' || char === 'q') {
		process.exit()
	} else if (char === 'j') {
		currentVersion = Math.min(project.data.versions.length - 1, currentVersion + 1)
	} else if (char === 'k') {
		currentVersion = Math.max(0, currentVersion - 1)
	} else if (char === '\x0D') {
		ignoreKeystrokes = true
		process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
		const ref = project.data.versions[currentVersion]
		const dir = path.join(Ctx.repositoryDir, project.name)
		await execa`git -C ${dir} reset --hard HEAD`
		if (ref.startsWith('v')) {
			// TODO
			await execa`git -C ${dir} switch --detach refs/tags/${ref}`
		} else {
			await execa`git -C ${dir} switch --detach ${ref}`
		}

		ignoreKeystrokes = false
		currentScreen = 'main'
		await updateProjectData()
		await render('')
		return
	} else if (char === 'v' || char === '\x7F') {
		currentScreen = 'main'
		await render('')
		return
	}

	const sep = '='.repeat(process.stdout.columns)
	process.stdout.write(ansiEscapes.eraseScreen + ansiEscapes.cursorTo(0, 0))
	process.stdout.write(`REPOSITORY: ${project.name}\n`)
	for (let i = 0; i < project.data.versions.length; ++i) {
		const version = project.data.versions[i]
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
	await Promise.all(
		Projects.map((project) => {
			return new Promise(async (resolve, reject) => {
				try {
					await mutateProject(project)
					resolve(undefined)
				} catch (err) {
					reject(err)
				}
			})
		}),
	)

	async function mutateProject(/** @type {Project} */ project) {
		const dir = path.join(Ctx.repositoryDir, project.name)
		const projectExists = await fileExists(dir)

		if (!project.data) {
			project.data = {}
		}
		project.data.isCloned = projectExists
		project.data.gitRef = ''

		if (!projectExists) {
			return
		}

		// First set of mutations
		const [{ stdout: currentTag }, { stdout: latestTag }] = await Promise.all([
			await execa`git -C ${dir} tag --points-at HEAD`,
			await execa`git -C ${dir} describe --tags --abbrev=0`.catch(() => ({
				stdout: '',
			})),
		])
		if (currentTag) {
			if (currentTag === latestTag) {
				project.data.isOutOfDate = false
				project.data.gitRef = currentTag
			} else {
				project.data.isOutOfDate = true
				project.data.gitRef = currentTag
			}
		} else {
			const [
				{ stdout: localRef },
				{ stdout: remoteRef },
				{ stdout: remoteRefFormatted },
			] = await Promise.all([
				await execa`git -C ${dir} rev-parse --short HEAD`,
				await execa`git -C ${dir} rev-parse --short @{u}`.catch(() => ({ stdout: '' })),
				await execa`git -C ${dir} rev-parse --abbrev-ref @{u}`.catch(() => ({
					stdout: '',
				})),
			])

			if (localRef === remoteRef) {
				project.data.isOutOfDate = false
				project.data.gitRef = remoteRefFormatted
			} else {
				project.data.isOutOfDate = true
				project.data.gitRef = localRef
			}
		}

		// Last mutations
		const remoteName = 'me' // TODO: Assumes this
		await execa`git -C ${dir} fetch --all`
		let [{ stdout }, { stdout: remoteRef }, { stdout: defaultRemoteRefSpec }] =
			await Promise.all([
				execa`git -C ${dir} tag --list`,
				execa`git -C ${dir} rev-parse --abbrev-ref @{u}`.catch(() => ({ stdout: '' })),
				execa`git -C ${dir} symbolic-ref refs/remotes/${remoteName}/HEAD --short`,
			])

		if (!remoteRef) {
			const { stdout: remoteHead } =
				await execa`git -C ${dir} rev-parse --short ${defaultRemoteRefSpec}`
			remoteRef = remoteHead
		}

		const tags = stdout.split('\n')
		const versions = tags
			.filter((tag) => tag.startsWith('v'))
			.sort((a, b) => (semver.gt(a, b) ? -1 : semver.lt(a, b) ? 1 : 0))
		project.data.versions = [remoteRef].concat(versions)
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
