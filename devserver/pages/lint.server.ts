import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import * as v from 'valibot'

export type PageSchemaT = v.InferInput<typeof PageSchema>
export const PageSchema = v.object({
	devCommand: v.string(),
})

export async function PageData(): Promise<PageSchemaT> {
	const [devCommand] = await Promise.all([
		execa('dev', ['lint', '/home/edwin/Documents/Programming/bookmark-manager']).catch(
			(err) => err,
		),
	])

	return {
		devCommand: stripAnsi(devCommand.stdout),
	}
}
