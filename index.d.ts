import type { ProjectInfo } from './util/util.js'

export type ProjectInfo =
	| {
			gitHasRemote: false
			branchName: string
	  }
	| {
			gitHasRemote: true
			branchName: string
			remoteName: string
			remoteUrl: string
			owner: string
			name: string
	  }

export type RuleSetInfo = {
	group: string
	ruleSet: string
	id: string
	filter: (longId: string) => boolean
}

export type RuleInfo = {
	group: string
	ruleSet: string
	rule: string
	id: string
}

export type Rule = {
	id: string
	deps?: Array<(() => boolean) | (() => Promise<boolean>)>
	shouldFix: (() => boolean) | (() => Promise<boolean>)
	fix?: (() => void) | (() => Promise<void>)
} | null

export type CreateRules = (arg0: {
	project: ProjectInfo
	projectConfig: unknown
}) => Rule[] | Promise<Rule[]>
