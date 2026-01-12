import * as fs from 'node:fs/promises'
import { fileExists, filesMustHaveContent } from '#common'
import type { PackageJson } from 'type-fest'
import type { Issues } from '#types'
import { execa } from 'execa'
import * as YAML from 'yaml'

export const issues: Issues = async function* issues() {
	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	const packageJson: PackageJson = JSON.parse(packageJsonText)

	if (!packageJson.packageManager) {
		yield {
			message: [
				'Expected "packageManager" field to be specified in package.json',
				'But, no "packageManager" field was found',
			],
			fix: async () => {
				await execa`corepack enable`
				await execa`corepack use pnpm@latest`
			},
		}
	}

	if (!await fileExists('pnpm-workspace.yaml')) {
		yield* filesMustHaveContent({
			'pnpm-workspace.yaml': `publicHoistPattern:\n  - 'prettier'\n`,
		})
	}

	const pnpmWorkspaceText = await fs.readFile('pnpm-workspace.yaml', 'utf-8')
	const pnpmworkspaceYaml = YAML.parse(pnpmWorkspaceText)
	if (
		!Array.isArray(pnpmworkspaceYaml?.publicHoistPattern) ||
		!pnpmworkspaceYaml?.publicHoistPattern.includes('prettier')
	) {
		yield {
			message: [
				'Expected pnpm-workspace.yaml to contain publicHoistPattern with prettier',
				'But, the required publicHoistPattern configuration was not found',
			],
			fix: async () => {
				if (!pnpmworkspaceYaml.publicHoistPattern) {
					pnpmworkspaceYaml.publicHoistPattern = ['prettier']
				} else if (!pnpmworkspaceYaml.publicHoistPattern.includes('prettier')) {
					pnpmworkspaceYaml.publicHoistPattern.push('prettier')
				}

				const content = YAML.stringify(pnpmworkspaceYaml)
				await fs.writeFile('pnpm-workspace.yaml', content)
			},
		}
	}
}
