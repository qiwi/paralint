#!/usr/bin/env node

import { main } from './index'

main(process.argv.slice(2))
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
