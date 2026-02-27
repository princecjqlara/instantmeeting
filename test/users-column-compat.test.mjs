import test from 'node:test'
import assert from 'node:assert/strict'

import { isMissingUsersColumnError } from '../src/lib/users-column-compat.ts'

test('isMissingUsersColumnError detects Postgres missing column errors', () => {
    const missing = isMissingUsersColumnError(
        { message: 'column users.auto_admit does not exist' },
        'auto_admit'
    )

    assert.equal(missing, true)
})

test('isMissingUsersColumnError detects PostgREST schema cache errors', () => {
    const missing = isMissingUsersColumnError(
        { message: "Could not find the 'auto_admit' column of 'users' in the schema cache" },
        'auto_admit'
    )

    assert.equal(missing, true)
})

test('isMissingUsersColumnError ignores unrelated errors', () => {
    const missing = isMissingUsersColumnError(
        { message: 'permission denied for table users' },
        'auto_admit'
    )

    assert.equal(missing, false)
})
