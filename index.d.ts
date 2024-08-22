import type { Project } from './fix/util.js'

export type Project =
	| {
		type: 'dir'
	}
	| {
			type: 'vcs-only'
			branchName: string
	  }
	| {
			type: 'vcs-with-remote'
			branchName: string
			remoteName: string
			remoteUrl: string
			owner: string
			name: string
	  }

export type Config = {}

export type Options = {
	yes: boolean,
	match: string[],
	exclude: string[],
	only: string[]
}

export type Issues = (arg0: {
	project: Project
	config: {
		projectSize: 'small' | 'large'
		ignoredChecks: string[]
	}
}) => AsyncGenerator<Issue>

export type Issue = {
	message: string | string[],
	fix?: (() => void) | (() => Promise<void>)
}
