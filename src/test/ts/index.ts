import  { expect } from "earljs"
import { test } from "uvu"

import { foo } from '../../main/ts/index'

test('index - foo() result equals bar', () => {
  expect(foo()).toEqual('bar')
})

test.run()
