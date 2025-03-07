import { Navigation } from '#components/Navigation.ts'
import { execa } from 'execa'
import { html } from 'htm/preact'
import { useRef, useState } from 'preact/hooks'

import type { RepoDetails, RepoGroups } from '#utilities/repositories.ts'
import { Fragment } from 'preact'

export async function Server() {
	const { getCachedRepositoryGroups, getCachedRepositoryDetails } = await import(
		'#utilities/repositories.ts'
	)

	const [repoGroups, repoDetails] = await Promise.all([
		getCachedRepositoryGroups(),
		getCachedRepositoryDetails(),
	])

	return {
		repoGroups,
		repoDetails,
	}
}

export function Page({
	repoGroups,
	repoDetails,
}: {
	repoGroups: RepoGroups
	repoDetails: RepoDetails
}) {
	const [selectedRepoGroupId, setSelectedRepoGroupId] = useState(repoGroups[0].groupId)
	const selectedRepoGroup = repoGroups.find(
		({ groupId }) => groupId === selectedRepoGroupId,
	) ?? { repos: [] }

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

	function showInfo(repository: string) {
		const [owner, name] = repository.split('/')
		alert('WIP')
	}

	return html`<${Fragment}>
		<dialog>
			<h1>repo</h1>
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
					${repoGroups.map(({ groupName, groupId, repos }) => {
						return groupId === selectedRepoGroupId
							? html`<b
									class="hover-bold"
									style="cursor: pointer"
									onClick=${() => setSelectedRepoGroupId(groupId)}
									>${groupName}</b
								>`
							: html`<p
									class="hover-bold"
									style="cursor: pointer"
									onClick=${() => setSelectedRepoGroupId(groupId)}
								>
									${groupName}
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
						<button
							class="button"
							onClick=${() => {
								fetch('/api/repositories/info', {
									method: 'POST',
									headers: {
										'Content-Type': 'application/json',
									},
									body: JSON.stringify({
										repos: selectedRepoGroup?.repos ?? [],
									}),
								})
									.then((res) => {
										return res.json()
									})
									.then((json) => {
										alert('Done')
									})
							}}
						>
							Refresh This Info
						</button>

						<button
							class="button"
							onClick=${() => {
								setDirsDialog(true)
							}}
						>
							Configure Clone Destinations
						</button>
					</div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
						${selectedRepoGroup.repos.map((fullName) => {
							return html`
									<div class="p-1" style="border: 1px solid lightgray; border-radius: 4px;">
										<h3 class="title is-5 mb-1">${fullName}</h3>
										${
											repoDetails.find((detail) => detail.fullName === fullName)?.isCloned
												? html`<button
														class="button is-primary mr-1"
														onClick=${() => openRepository(fullName)}
													>
														Open
													</button>`
												: html`<button
														class="button is-primary mr-1"
														onClick=${() => cloneRepository(fullName)}
													>
														Clone
													</button>`
										}

										<button class="button mr-1" disabled onClick=${() => showInfo(fullName)}>Info</button>

										<p>Behind 1 ahead 2</p>

								</li>`
						})}
					</div>
				</div>
			</div>
		</div>
	<//>`
}
