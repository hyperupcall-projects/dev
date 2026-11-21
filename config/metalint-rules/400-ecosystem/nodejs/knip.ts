import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '#utilities/util.ts'
import type { Issues } from '#types'

export const skip = true

export const issues: Issues = async function* issues({ project }) {}
