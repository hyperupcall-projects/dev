import * as v from 'valibot'
import { RepoGroups, RepoDetails } from '#utilities/repositories.ts'

export type PageSchemaT = v.InferInput<typeof PageSchema>
export const PageSchema = v.object({
	repoGroups: RepoGroups,
	repoDetails: RepoDetails,
})
