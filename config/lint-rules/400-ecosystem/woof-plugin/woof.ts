// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2025 Edwin Kofler
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { fileExists, octokit } from '#common'
import type { Issues, Project } from '#types'

export const issues: Issues = async function* issues({ project }: { project: Project }) {
	if (project.type !== 'with-remote-url') {
		yield { skip: 'Not a project with remote URL' }
		return
	}

	// Parse INI file.
	const manifestPath = path.join(project.rootDir, 'manifest.ini')
	const manifestContent = await fs.readFile(manifestPath, 'utf-8')
	const manifestLines = manifestContent.split('\n')
	let manifestName: string | null = null
	let manifestDescription: string | null = null
	let nameLineIndex = -1
	let descriptionLineIndex = -1
	for (let i = 0; i < manifestLines.length; i++) {
		const line = manifestLines[i].trim()
		if (line.startsWith('name =') || line.startsWith('name=')) {
			const match = line.match(/^name\s*=\s*(.+)$/)
			if (match) {
				manifestName = match[1].trim()
				nameLineIndex = i
			}
		} else if (line.startsWith('description =') || line.startsWith('description=')) {
			const match = line.match(/^description\s*=\s*(.+)$/)
			if (match) {
				manifestDescription = match[1].trim()
				descriptionLineIndex = i
			}
		}
	}

	// Check that the project name matches the directory name.
	const expectedName = path.basename(project.rootDir).replace(/^woof-plugin-/, '')
	if (manifestName !== expectedName) {
		yield {
			id: 'name-mismatch',
			message: [
				`Expected "name" in manifest.ini to be "${expectedName}"`,
				`But, found "${manifestName}"`,
			],
			fix: async () => {
				if (nameLineIndex !== -1) {
					manifestLines[nameLineIndex] = `name = ${expectedName}`
					await fs.writeFile(manifestPath, manifestLines.join('\n'))
				}
			},
		}
	}

	// Check that the project description matches the GitHub description.
	const { data: { description: githubDescription } } = await octokit.rest.repos.get({
		owner: project.owner,
		repo: project.name,
	})
	if (githubDescription && manifestDescription !== githubDescription) {
		yield {
			id: 'description-mismatch',
			message: [
				`Expected "description" in manifest.ini to be "${githubDescription}"`,
				`But, found "${manifestDescription}"`,
			],
			fix: async () => {
				if (descriptionLineIndex !== -1) {
					manifestLines[descriptionLineIndex] = `description = ${githubDescription}`
					await fs.writeFile(manifestPath, manifestLines.join('\n'))
				} else {
					if (nameLineIndex !== -1) {
						manifestLines.splice(nameLineIndex + 1, 0, `description = ${githubDescription}`)
						await fs.writeFile(manifestPath, manifestLines.join('\n'))
					}
				}
			},
		}
	}
}

async function getGitHubDescription(project: Project & { type: 'with-remote-url' }): Promise<string | null> {
	try {
		const { data } = await octokit.rest.repos.get({
			owner: project.owner,
			repo: project.name,
		})
		return data.description || null
	} catch {
		return null
	}
}
