import type { Props } from './index.ts'
import type { PageDataFn } from '#types'
import { getServiceData } from '#utilities/util.ts'

export const PageData: PageDataFn<Props> = async function PageData() {
	const services: Props['services'] = await getServiceData()

	return {
		services,
	}
}
