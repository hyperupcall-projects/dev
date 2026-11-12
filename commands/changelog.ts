import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
import { execa } from 'execa'
import * as diff from 'diff'

import { fileExists, octokit } from '#common'
import type { CommandChangelogValidateOptions, CommandScriptOptions } from '#types'

type Release = Awaited<ReturnType<typeof octokit.rest.repos.listReleases>>['data'][number]


const changelogFileName = 'CHANGELOG.md'

async function getRepositoryInfo(): Promise<{
	owner: string
	repo: string
}> {
	if (!(await fileExists('.git'))) {
		console.error('Not a git repository (no .git directory)')
		process.exit(1)
	}

	const { stdout: branchName } = await execa('git', ['branch', '--show-current']).catch(
		() => ({
			stdout: '',
		}),
	)
	// TODO
	const remoteNameResult = await (async () => {
		try {
			if (branchName) {
				return await execa('git', ['config', '--get', `branch.${branchName}.remote`])
			} else {
				return await execa('git', [
					'config',
					'--default',
					'origin',
					'--get',
					'clone.defaultRemoteName',
				])
			}
		} catch {
			return { stdout: null }
		}
	})()

	const remoteName =
		remoteNameResult && typeof remoteNameResult.stdout === 'string'
			? remoteNameResult.stdout.trim()
			: ''
	if (!remoteName) {
		console.error('Could not determine git remote name for this repository')
		process.exit(1)
	}

	const { stdout: remoteUrl } = await execa('git', [
		'remote',
		'get-url',
		remoteName,
	]).catch(() => ({ stdout: '' }))
	if (!remoteUrl) {
		console.error(`Could not get URL for remote "${remoteName}"`)
		process.exit(1)
	}

	const match = parseGitHubRepository(remoteUrl)
	if (!match) {
		console.error(`Could not parse GitHub owner and repo from remote URL: ${remoteUrl}`)
		process.exit(1)
	}

	return match
}

function parseGitHubRepository(
	remoteUrl: string,
): { owner: string; repo: string } | undefined {
	const url = remoteUrl.trim()

	// SSH: git@github.com:owner/repo.git
	const scpMatch = url.match(/^[^/\s]+@[^:/\s]+:(?<path>.+)$/u)
	// URL: https://github.com/owner/repo.git
	const urlMatch = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+\/(?<path>.+)$/u)

	const repositoryPath = scpMatch?.groups?.path ?? urlMatch?.groups?.path
	if (!repositoryPath) {
		return undefined
	}

	const segments = repositoryPath
		.replace(/\.git$/u, '')
		.split('/')
		.filter((segment) => segment !== '')
	if (segments.length < 2) {
		return undefined
	}

	return {
		owner: segments[0],
		repo: segments[1],
	}
}

async function fetchReleases({ owner, repo }: {
	owner: string
	repo: string
}): Promise<Release[]> {
	// Fetch releases (paginate)
	const releases: Release[] = []
	let page = 1
	while (true) {
		let res: Awaited<ReturnType<typeof octokit.rest.repos.listReleases>>
		try {
			res = await octokit.rest.repos.listReleases({
				owner,
				repo,
				per_page: 100,
				page,
			})
		} catch (error) {
			console.error(
				`Could not fetch the releases of ${owner}/${repo} from GitHub: ${
					(error as Error).message
				}`,
			)
			process.exit(1)
		}
		releases.push(...res.data)
		if (res.data.length < 100) break
		page += 1
	}

	// Sort releases from newest to oldest by published_at (fallback to created_at)
	releases.sort((a, b) => {
		const ad = new Date(a.published_at || a.created_at || 0).getTime()
		const bd = new Date(b.published_at || b.created_at || 0).getTime()
		return bd - ad
	})

	return releases
}

function generateChangelog(releases: Release[], { owner, repo }: {
	owner: string
	repo: string
}): string {
	let out = '# Changelog\n\n'
	if (releases.length === 0) {
		out += '_No releases found._\n'
	} else {
		for (const r of releases) {
			const currentTag = r.tag_name ?? r.name ?? ''
			const releaseUrl =
				r.html_url ?? `https://github.com/${owner}/${repo}/releases/tag/${currentTag}`

			out += `## [${currentTag}](${releaseUrl})\n\n`

			let body = (r.body ?? '').toString()
			// Downgrade every markdown heading by one level (add one '#')
			body = body.replace(
				/^(\s*)(#+)(\s+)/gm,
				(_match, ws, hashes, sp) => `${ws}${hashes}#${sp}`,
			)

			out += `${body}\n\n`
		}
	}

	return out
}

function formatDiff(current: string, generated: string): string {
	const patch = diff.createTwoFilesPatch(
		changelogFileName,
		`${changelogFileName} (generated from GitHub releases)`,
		current,
		generated,
		'current',
		'generated',
		{ context: 3 },
	)

	return patch
		.replaceAll(/\n\+(?!\+\+)/g, '\n' + styleText('green', '+'))
		.replaceAll(/\n-(?!--)/g, '\n' + styleText('red', '-'))
}

export async function runPull(_options: CommandScriptOptions) {
	const repositoryInfo = await getRepositoryInfo()
	const releases = await fetchReleases(repositoryInfo)
	const out = generateChangelog(releases, repositoryInfo)

	const targetPath = path.join(process.cwd(), changelogFileName)
	await fs.writeFile(targetPath, out, 'utf-8')
	console.info(`Wrote ${targetPath}`)
}

export async function runValidate(options: CommandChangelogValidateOptions) {
	const repositoryInfo = await getRepositoryInfo()
	const releases = await fetchReleases(repositoryInfo)
	const generated = generateChangelog(releases, repositoryInfo)

	const targetPath = path.join(process.cwd(), changelogFileName)
	let current: string
	try {
		current = await fs.readFile(targetPath, 'utf-8')
	} catch {
		console.error(`Could not read ${targetPath}`)
		process.exit(1)
	}

	if (current === generated) {
		console.info(`${changelogFileName} matches the GitHub releases`)
		return
	}

	console.error(`${changelogFileName} does not match the GitHub releases`)
	if (options.diff) {
		console.info(formatDiff(current, generated))
	}
	process.exit(1)
}
