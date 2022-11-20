import  { expect } from "earljs"
import { test } from "uvu"

import { foo } from '../../../target/es6'

test('index (es6) - foo() result equals bar', () => {
  expect(foo()).toEqual('bar')
})


test.run()
