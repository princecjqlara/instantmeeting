import test from 'node:test'
import assert from 'node:assert/strict'

import { planTenantProvisioning } from '../src/lib/tenant-provisioning.ts'

test('planTenantProvisioning creates tenant when user does not exist', () => {
    const plan = planTenantProvisioning({
        existingUser: null,
        email: 'tenant@example.com',
        name: 'Tenant User',
    })

    assert.equal(plan.mode, 'create')
    assert.deepEqual(plan.data, {
        email: 'tenant@example.com',
        name: 'Tenant User',
        role: 'tenant',
    })
})

test('planTenantProvisioning updates existing non-organizer user', () => {
    const plan = planTenantProvisioning({
        existingUser: { id: 'u_1', role: 'tenant' },
        email: 'tenant@example.com',
        name: null,
    })

    assert.equal(plan.mode, 'update')
    assert.equal(plan.id, 'u_1')
    assert.deepEqual(plan.data, {
        name: null,
        role: 'tenant',
    })
})

test('planTenantProvisioning rejects organizer accounts', () => {
    const plan = planTenantProvisioning({
        existingUser: { id: 'u_1', role: 'organizer' },
        email: 'organizer@example.com',
        name: 'Organizer',
    })

    assert.equal(plan.mode, 'reject')
})
