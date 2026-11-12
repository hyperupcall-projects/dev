import type { Issues } from '#types'
import { fileExists } from '#common'
import { execa } from 'execa'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// https://lefthook.dev/configuration/index.html#config-file-name
const lefthookConfigFiles = [
	'.lefthook.yaml',
	'.lefthook.yml',
	'.lefthook.toml',
	'.lefthook.json',
	'lefthook.yaml',
	'lefthook.yml',
	'lefthook.toml',
	'lefthook.json',
]

// The marker that lefthook writes into the git hooks it manages.
// https://github.com/evilmartians/lefthook/blob/master/internal/command/lefthook.go
const lefthookHookMarker = 'LEFTHOOK'

/**
 * Check that the project does not have any lefthook files.
 */
export const issues: Issues = async function* issues() {
	// Check that there are no lefthook configuration files.
	{
		const existingFiles: string[] = []
		for (const file of lefthookConfigFiles) {
			if (await fileExists(file)) {
				existingFiles.push(file)
			}
		}

		if (existingFiles.length > 0) {
			yield {
				id: 'lefthook-must-not-have-config-files',
				message: [
					'Expected to find no lefthook files',
					`But, found ${existingFiles.length} lefthook files: ${existingFiles
						.map((file) => `"${file}"`)
						.join(', ')}`,
				],
				fix: async () => {
					await Promise.all(existingFiles.map((file) => fs.rm(file)))
				},
			}
		}
	}

	// Check that lefthook is not activated for the current project.
	{
		const { stdout } = await execa('git', [
			'rev-parse',
			'--path-format=absolute',
			'--git-path',
			'hooks',
			'--git-path',
			'info',
		])
		const [hooksPath, infoPath] = stdout.trim().split('\n')
		const checksumPath = path.join(infoPath, 'lefthook.checksum')
		if (await fileExists(checksumPath)) {
			yield {
				id: 'lefthook-must-not-be-activated',
				message: ['Expected lefthook to not be activated for current project'],
				fix: async () => {
					await removeLefthookHooks(hooksPath)
					await fs.rm(checksumPath, { force: true })
					await fs.rm(path.join(infoPath, 'lefthook-remotes'), {
						recursive: true,
						force: true,
					})
				},
			}
		}
	}
}

/**
 * Remove lefthook-managed git hooks.
 * See https://github.com/evilmartians/lefthook/blob/master/internal/command/uninstall.go.
 */
async function removeLefthookHooks(hooksPath: string) {
	const files = await fs.readdir(hooksPath).catch(() => [] as string[])
	for (const file of files) {
		const hookPath = path.join(hooksPath, file)
		const content = await fs.readFile(hookPath, 'utf-8').catch(() => '')
		if (!content.includes(lefthookHookMarker)) {
			continue
		}

		await fs.rm(hookPath, { force: true })

		// Recover the hook that lefthook has renamed.
		const oldHookPath = `${hookPath}.old`
		if (await fileExists(oldHookPath)) {
			await fs.rename(oldHookPath, hookPath)
		}
	}
}
