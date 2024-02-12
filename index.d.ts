import type { Project as Project } from './fix/util.js'

export type Project =
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
}

export type CreateRules = (arg0: {
	project: Project
	metadata: {
		projectSize: 'small' | 'large'
		ignoredChecks: string[]
	}
}) => Rule[] | Promise<Rule[]>
