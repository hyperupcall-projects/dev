import { html } from 'htm/preact'
import { useEffect, useState } from 'preact/hooks'
import * as v from 'valibot'

export type PageSchemaT = v.InferInput<typeof PageSchema>
export const PageSchema = v.strictObject({})

export async function PageData(): Promise<PageSchemaT> {
	return {}
}
