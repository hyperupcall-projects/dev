import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

import { fileExists, octokit } from '#common'
import type { CommandScriptOptions } from '#types'

export async function run(options: CommandScriptOptions, positionals: string[]) {
	const sub = positionals[0]
	if (sub !== 'pull') {
		console.error(`Unknown changelog subcommand: ${sub}`)
		Deno.exit(1)
	}

	if (!(await fileExists('.git'))) {
		console.error('Not a git repository (no .git directory)')
		Deno.exit(1)
	}

	const { stdout: branchName } = await execa('git', ['branch', '--show-current']).catch(() => ({
		stdout: '',
	}))
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

	const remoteName = (remoteNameResult && typeof remoteNameResult.stdout === 'string')
		? remoteNameResult.stdout.trim()
		: ''
	if (!remoteName) {
		console.error('Could not determine git remote name for this repository')
		Deno.exit(1)
	}

	const { stdout: remoteUrl } = await execa('git', ['remote', 'get-url', remoteName]).catch(
		() => ({ stdout: '' })
	)
	if (!remoteUrl) {
		console.error(`Could not get URL for remote "${remoteName}"`)
		Deno.exit(1)
	}

	const match = remoteUrl.match(/[:/](?<owner>.*?)\/(?<name>.*?)(?:\.git)?$/u)
	if (!match?.groups) {
		console.error(`Could not parse GitHub owner and repo from remote URL: ${remoteUrl}`)
		Deno.exit(1)
	}

	const owner = match.groups.owner
	const repo = match.groups.name

	// Fetch releases (paginate)
	const releases: any[] = []
	let page = 1
	while (true) {
		const res = await octokit.rest.repos.listReleases({ owner, repo, per_page: 100, page })
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

	let out = '# Changelog\n\n'
	if (releases.length === 0) {
		out += '_No releases found._\n'
	} else {
		for (let i = 0; i < releases.length; i++) {
			const r = releases[i]
			const currentTag = r.tag_name ?? r.name ?? ''
			const releaseUrl = r.html_url ??
				`https://github.com/${owner}/${repo}/releases/tag/${currentTag}`

			out += `## [${currentTag}](${releaseUrl})\n\n`

			const prevTag = releases[i + 1]
				? (releases[i + 1].tag_name ?? releases[i + 1].name ?? '')
				: ''
			if (prevTag) {
				out +=
					`**Full Changelog**: https://github.com/${owner}/${repo}/compare/${prevTag}...${currentTag}\n\n`
			} else {
				out += `**Full Changelog**: https://github.com/${owner}/${repo}/releases\n\n`
			}

			let body = (r.body ?? '').toString()
			// Downgrade every markdown heading by one level (add one '#')
			body = body.replace(
				/^(\s*)(#+)(\s+)/gm,
				(_match, ws, hashes, sp) => `${ws}${hashes}#${sp}`,
			)

			out += `${body}\n\n`
		}
	}

	const targetPath = path.join(process.cwd(), 'CHANGELOG.md')
	await fs.writeFile(targetPath, out, 'utf-8')
	console.info(`Wrote ${targetPath}`)
}
