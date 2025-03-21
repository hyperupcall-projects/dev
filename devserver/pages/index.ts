import { Fragment } from 'preact'
import { html } from 'htm/preact'
import { Navigation } from '#components/Navigation.ts'
import type { PageSchemaT } from './index.server.ts'

export function Page({ services }: PageSchemaT) {
	return html`
		<${Fragment}>
			<${Navigation} />
			<div style="border-inline: 1px solid lightgray">
				<div style="display: grid; grid-template-columns: 1fr 1fr">
					<div
						class="p-1"
						style="background-color: antiquewhite; border-inline-end: 1px solid lightgray"
					>
						<h1 class="title mb-0">Services</h1>
						<div class="content">
							<ul class="index-ul" style="margin-inline-start: 18px;">
								${services
									? services.map(
											(service) =>
												html`<li>
													<a
														class="hover-bold"
														style="${service.isActive
															? 'color: lightgreen'
															: 'color: red'}"
														href="/services#${service.name}"
													>
														${service.name}
													</a>
												</li>`,
										)
									: ''}
							</ul>
						</div>
					</div>
					<div class="p-1" style="background-color: aliceblue">
						<h1 class="title mb-0">Recent Projects</h1>
					</div>
				</div>
				<div
					class="p-1"
					style="background-color: wheat; border-block: 1px solid lightgray;"
				>
					<h1 class="mb-0 title">Projects</h1>
					<p><a href="/projects">View All Projects</a></p>
				</div>
			</div>
		<//>
	`
}
