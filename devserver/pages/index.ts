import { h, Fragment } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import { html } from 'htm/preact'
import type { PageFn } from '#types'
import { Navigation } from '#components/Navigation.ts'
import type { getServiceData } from '#utilities/util.ts'

export type Props = {
	services: Awaited<ReturnType<typeof getServiceData>>
}

export const Page: PageFn<Props> = function Page({ services }) {
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
					<h1 class="mb-0 title">Repositories</h1>
					<p><a href="/repositories">View All Repositories</a></p>
				</div>
			</div>
		<//>
	`
}
