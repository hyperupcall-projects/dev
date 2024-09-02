import { execa } from 'execa'
import { deleteAsync } from 'del'
import * as fs from 'node:fs/promises'
import { globby } from 'globby'
import path from 'node:path'
import { existsSync } from 'node:fs'

export async function run() {
	const templatesDir =
		'/storage/ur/storage_home/Docs/Projects/Programming/Organizations/fox-templates'

	/**
	 * @param {string[]} args
	 * @param {boolean} [capture]
	 */
	async function git(args, capture = false) {
		const result = await execa('git', args, {
			stdio: capture ? 'pipe' : 'inherit',
			env: {
				GIT_CONFIG_GLOBAL: '/dev/null',
				GIT_CONFIG_SYSTEM: '/dev/null',
				GIT_CONFIG_NOSYSTEM: '1',
				GIT_COMMITTER_NAME: 'Captain Woofers',
				GIT_COMMITTER_EMAIL: '99463792+captain-woofers@users.noreply.github.com',
				GIT_AUTHOR_NAME: 'Captain Woofers',
				GIT_AUTHOR_EMAIL: '99463792+captain-woofers@users.noreply.github.com',
			},
		})

		if (capture) {
			return result
		}
	}

	for (const templateDirname of await fs.readdir(templatesDir)) {
		const dirsToDelete = await globby([`*`, '!.git/'], {
			cwd: path.join(templatesDir, templateDirname),
			dot: true,
			absolute: true,
		})
		await deleteAsync(dirsToDelete, { force: true })
	}

	for (const args of [
		[
			'--ecosystem',
			'nodejs',
			'--variant',
			'hello-world',
			'--name',
			'hello-world',
			'--options',
			'noexec',
			path.join(templatesDir, 'nodejs-hello-world'),
		],
		[
			'--ecosystem',
			'nodejs',
			'--variant',
			'cli',
			'--name',
			'my-cli',
			'--options',
			'noexec',
			path.join(templatesDir, 'nodejs-cli'),
		],
		[
			'--ecosystem',
			'nodejs',
			'--variant',
			'web-server-express',
			'--name',
			'my-server',
			'--options',
			'noexec',
			path.join(templatesDir, 'nodejs-web-server-express'),
		],
		[
			'--ecosystem',
			'cpp',
			'--variant',
			'hello-world',
			'--name',
			'hello-world',
			'--options',
			'noexec',
			path.join(templatesDir, 'cpp-hello-world'),
		],
		[
			'--ecosystem',
			'cpp',
			'--variant',
			'playground',
			'--name',
			'cpp-playground',
			'--options',
			'noexec',
			path.join(templatesDir, 'cpp-playground'),
		],
	]) {
		await execa(
			'pnpm',
			[
				'--package=/storage/ur/storage_home/Docs/Projects/Programming/Organizations/fox-tools/dev',
				'dlx',
				'new',
				...args,
			],
			{
				stdio: 'inherit',
			},
		)
	}

	for (const templateDirname of await fs.readdir(templatesDir)) {
		if (!existsSync(path.join(templatesDir, templateDirname, '.git'))) {
			await git([
				'init',
				'--initial-branch=main',
				path.join(templatesDir, templateDirname),
			])
		}
	}

	for (const templateDirname of await fs.readdir(templatesDir)) {
		const projectDir = path.join(templatesDir, templateDirname)
		await git(['-C', projectDir, 'add', '--all'])
		const result = await git(['-C', projectDir, 'status', '--short'], true)
		if (result?.stdout && result.stdout.length > 0) {
			await git(['-C', projectDir, 'commit', '--message=Update'])
		}
	}
}
