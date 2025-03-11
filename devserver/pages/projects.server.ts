export async function PageData() {
	const { getCachedRepositoryGroups, getCachedRepositoryDetails } = await import(
		'#utilities/repositories.ts'
	)

	const [repoGroups, repoDetails] = await Promise.all([
		getCachedRepositoryGroups(),
		getCachedRepositoryDetails(),
	])

	return {
		repoGroups,
		repoDetails,
	}
}

export function Api(express: Express) {}
