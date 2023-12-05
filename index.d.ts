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

export type CreateRules = (() => Rule[]) | (() => Promise<Rule[]>)

export type Rule = {
	id: string,
	deps: Array<(() => boolean) | (() => Promise<boolean>)>,
	shouldFix: (() => boolean) | (() => Promise<boolean>),
	fix: (() => void) | (() => Promise<void>)
}
