import { signal } from '@preact/signals'
import { Navigation } from '#components/Navigation.ts'
import { execa } from 'execa'
import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import {
	getCachedRepositoryConfig,
	getCachedRepositoryData,
} from '#utilities/repositories.ts'
import type { ClonedReposConfig, RepositoryData } from '#utilities/repositories.ts'
import { Fragment } from 'preact'

export async function Server() {
	const [repositoryConfig, repositoryData] = await Promise.all([
		getCachedRepositoryConfig(),
		getCachedRepositoryData(),
	])

	return {
		repositoryConfig,
		repositoryData,
	}
}

export function Page({
	repositoryConfig,
	repositoryData,
}: {
	repositoryConfig: ClonedReposConfig
	repositoryData: RepositoryData
}) {
	const [selectedRepository, setSelectedRepository] = useState(
		repositoryConfig.repositoryGroups[0].name,
	)
	const selectedRepositoryGroup = repositoryConfig.repositoryGroups.find(
		(group) => group.name === selectedRepository,
	)
	function onClick(newName: string) {
		setSelectedRepository(newName)
	}
	function cloneAll() {}
	function cloneRepository(repository: string) {
		const [owner, name] = repository.split('/')
		fetch('/api/repositories/clone', {
			method: 'POST',
			body: JSON.stringify({ owner, name }),
			headers: {
				'Content-Type': 'application/json',
			},
		})
	}
	function openRepository(repository: string) {
		const [owner, name] = repository.split('/')
		fetch('/api/repositories/open', {
			method: 'POST',
			body: JSON.stringify({ owner, name }),
			headers: {
				'Content-Type': 'application/json',
			},
		})
	}

	const [dialogInfo, setDialogInfo] = useState({
		repository: '',
	})
	function showInfo(repository: string) {
		const [owner, name] = repository.split('/')
		alert('WIP')
	}

	return html`<${Fragment}>
		<dialog>
			<h1>${dialogInfo.repository}</h1>
			<p>Behind 2 ahead 1</p>
			<p>Lint Result (and output)</p>
			<p>Braches (delete/add/see remote)</p>
			<p>Worktrees</p>
			<p>Age/size of repository</p>
			<p>Hidden directory?</p>
		</dialog>
		<div>
			<${Navigation} />
			<div
				style="display: grid; grid-template-columns: 230px 1fr; gap: 4px; margin-block-end: 4px;"
			>
				<aside
					class="p-1"
					style="background-color: lavender; border-radius: 4px; margin-block-start: 4px; margin-inline-start: 4px;"
				>
					${repositoryConfig.repositoryGroups.map((group) => {
						return group.name === selectedRepository
							? html`<b
									class="hover-bold"
									style="cursor: pointer"
									onClick=${() => onClick(group.name)}
									>${group.name}</b
								>`
							: html`<p
									class="hover-bold"
									style="cursor: pointer"
									onClick=${() => onClick(group.name)}
								>
									${group.name}
								</p>`
					})}
				</aside>
				<div
					class="pr-1"
					style="display: flex; flex-direction: column; gap: 4px; margin-block-start: 4px;"
				>
					<div style="display: flex; gap: 4px;">
						<button class="button" onClick=${cloneAll}>Clone All</button>
						<button
							class="button"
							onClick=${() => {
								fetch('/api/repositories/refresh', { method: 'POST' }).then(() => {
									alert('Done')
								})
							}}
						>
							Refresh ALL Repositories
						</button>
					</div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
						${selectedRepositoryGroup.repositories.map((repo) => {
							return html`
									<div class="p-1" style="border: 1px solid lightgray; border-radius: 4px;">
										<h3 class="title is-5 mb-1">${repo}</h3>
										${
											repositoryData[repo]?.status === 'noexist'
												? html`<button
														class="button is-primary mr-1"
														onClick=${() => cloneRepository(repo)}
													>
														Clone
													</button>`
												: html`<button
														class="button is-primary mr-1"
														onClick=${() => openRepository(repo)}
													>
														Open
													</button>`
										}

										<button class="button mr-1" disabled onClick=${() => showInfo(repo)}>Info</button>

										<p>Behind 1 ahead 2</p>

								</li>`
						})}
					</div>
				</div>
			</div>
		</div>
	<//>`
}
