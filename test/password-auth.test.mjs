import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

import { isValidCredentialPassword } from '../src/lib/password-auth.ts'

test('isValidCredentialPassword accepts exact password matches', async () => {
    const hash = await bcrypt.hash('tenant-pass-123', 4)

    const result = await isValidCredentialPassword('tenant-pass-123', hash)

    assert.equal(result, true)
})

test('isValidCredentialPassword accepts passwords with accidental outer whitespace', async () => {
    const hash = await bcrypt.hash('tenant-pass-123', 4)

    const result = await isValidCredentialPassword('  tenant-pass-123  ', hash)

    assert.equal(result, true)
})

test('isValidCredentialPassword does not accept missing intentional spaces', async () => {
    const hash = await bcrypt.hash('  organizer pass  ', 4)

    const result = await isValidCredentialPassword('organizer pass', hash)

    assert.equal(result, false)
})
