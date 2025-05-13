// import { Kysely, SqliteDialect } from 'kysely'
// import { DB } from 'kysely-codegen'
// import Database from 'better-sqlite3'
import { throwBadMeta } from '#webframeworklib'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

if (!import.meta.dirname) throwBadMeta('dirname')

// TODO: https://github.com/kysely-org/kysely/issues/1292#issuecomment-2670341588 ?
// const db = new Kysely<DB>({
// 	dialect: new SqliteDialect({
// 		// database: new Database(path.join(import.meta.dirname, '../.data/dev.db')),
// 		database: new DatabaseSync(path.join(import.meta.dirname, '../.data/dev.db'))
// 		async onCreateConnection() {
// 			console.info(`Connected to database...`)
// 		},
// 	}),
// })

const dbFile = path.join(import.meta.dirname, '../.data/dev.sqlite')
if (!existsSync(dbFile)) {
	writeFileSync(dbFile, '')
}
const db = new DatabaseSync(dbFile)

db.exec(`
CREATE TABLE IF NOT EXISTS project_queries (
	str TEXT NOT NULL UNIQUE,
	sort_idx INTEGER NOT NULL,
	json_params TEXT NOT NULL
) STRICT;`)
