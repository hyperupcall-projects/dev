import { html } from 'hono/html'
import { activityManagerPanel } from './activity-manager.ts'
import { knowledgeManagerPanel } from './knowledge-manager.ts'

export async function directoriesView() {
	const [knowledge, activity] = await Promise.all([
		knowledgeManagerPanel(),
		activityManagerPanel(),
	])

	return {
		title: 'Directories',
		content: html`
			<div class="p-4" id="directories">
				<div class="mb-4">
					<h1 class="title mb-1">Directories</h1>
					<p class="subtitle is-6 mb-0">
						Open knowledge folders and activity project folders
					</p>
				</div>

				<div class="columns is-desktop" id="directories-columns">
					<div class="column">${knowledge.content}</div>
					<div class="column">${activity.content}</div>
				</div>
			</div>
		`,
		scripts: html`${knowledge.scripts}${activity.scripts}`,
	}
}
