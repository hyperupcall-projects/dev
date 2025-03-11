import { execa } from 'execa'
import stripAnsi from 'strip-ansi'

export async function PageData() {
	const [devCommand] = await Promise.all([
		execa('dev', ['lint', '/home/edwin/Documents/Programming/bookmark-manager']).catch(
			(err) => err,
		),
	])

	return {
		devCommand: stripAnsi(devCommand.stdout),
	}
}
