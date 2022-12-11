#!/usr/bin/env node

import { main } from './index'

try {
    await main(process.argv.slice(2))
    process.exit(0)
} catch {
    process.exit(1)
}

