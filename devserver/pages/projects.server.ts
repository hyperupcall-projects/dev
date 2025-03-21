import * as v from 'valibot'
import {
	getCachedRepositoryGroups,
	getCachedRepositoryDetails,
} from '#utilities/repositories.ts'
import type { Request, Response } from 'express'
import type { PageSchemaT } from './projects.utils.ts'

export async function PageData(): Promise<PageSchemaT> {
	const [repoGroups, repoDetails] = await Promise.all([
		getCachedRepositoryGroups(),
		getCachedRepositoryDetails(),
	])

	return {
		repoGroups,
		repoDetails,
	}
}

export function Api(app: Express) {
	app.post('/projects/get-all', (req: Request, res: Response) => {
		const { id } = req.body as v.InferInput<
			(typeof routes)['/projects/get-all']['request']
		>
		// const v = validate(req.url)
		// if (!v.success) return showError(v)
	})
}
