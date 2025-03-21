import { getServiceData } from '#utilities/util.ts'
import * as v from 'valibot'

export type PageSchemaT = v.InferInput<typeof PageSchema>
export const PageSchema = v.object({
	services: v.array(
		v.object({
			name: v.string(),
			isActive: v.boolean(),
			statusOutput: v.string(),
		}),
	),
})

export async function PageData(): Promise<PageSchemaT> {
	const services: PageSchemaT['services'] = await getServiceData()

	return {
		services,
	}
}
