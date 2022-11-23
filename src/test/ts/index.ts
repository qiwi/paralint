import { expect } from 'earljs'
import { test } from 'uvu'

import { main } from '../../main/ts/index'

test('test', async () => {
  expect(await main()).toMatchSnapshot()
})

test.run()
