import { filesMustHaveContent, filesMustHaveName } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import { execa } from 'execa'
import Handlebars from 'handlebars'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'
import type { PackageJson } from 'type-fest'

export const issues: Issues = async function* issues({ project }) {
	const packageJson: PackageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

	yield* filesMustHaveName({
		'.config/hk.pkl': ['hk.pkl'],
	})
	yield* filesMustHaveContent('hk', {
		'.config/hk.pkl': Handlebars.compile(
			await fs.readFile(path.join(pkgRoot(), 'config/hk.pkl.hbs'), 'utf-8'),
		)({
			publicPackage: packageJson.private === false,
		}),
	})

	if (project.type !== 'only-directory' && !(await hasHkPreCommitHook())) {
		yield {
			id: 'hk-must-be-installed',
			message: [
				'Expected hk Git hooks to be installed for the current project',
				'But, no active hk pre-commit hook was found',
			],
			fix: async () => {
				await execa('hk', ['install'], { stdio: 'inherit' })
			},
		}
	}
}

async function hasHkPreCommitHook(): Promise<boolean> {
	const enabled = await execa(
		'git',
		['config', '--type=bool', '--get', 'hook.pre-commit.enabled'],
		{ reject: false },
	)
	if (enabled.exitCode === 0 && enabled.stdout === 'false') return false
	if (enabled.exitCode !== 0 && enabled.exitCode !== 1) {
		throw new Error(`Failed to read Git hook settings: ${enabled.stderr}`)
	}

	// Git 2.54+ supports hooks registered in local or global Git config.
	// Asking Git also excludes disabled hooks and non-executable hook scripts.
	const hooks = await execa('git', ['hook', 'list', '-z', 'pre-commit'], {
		reject: false,
	})
	if (hooks.exitCode === 0 || hooks.exitCode === 1) {
		const names = hooks.stdout.split('\0')
		if (names.includes('hk-pre-commit')) return true
		if (!names.includes('hook from hookdir')) return false
	} else if (hooks.exitCode !== 129) {
		throw new Error(`Failed to list Git hooks: ${hooks.stderr}`)
	}

	// Older Git versions do not support `git hook list`. Resolve the hooks
	// directory through Git so core.hooksPath and linked worktrees work too.
	const { stdout: hooksPath } = await execa('git', [
		'rev-parse',
		'--path-format=absolute',
		'--git-path',
		'hooks',
	])
	const hookPath = path.join(hooksPath, 'pre-commit')
	try {
		await fs.access(hookPath, fs.constants.X_OK)
		const content = await fs.readFile(hookPath, 'utf-8')
		return content.includes('test "${HK:-1}" = "0"') && content.includes('hk run')
	} catch (error) {
		if (error.code === 'ENOENT' || error.code === 'EACCES') return false
		throw error
	}
}
