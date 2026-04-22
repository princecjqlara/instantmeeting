import test from 'node:test'
import assert from 'node:assert/strict'

import {
    insertLeadFormWithCompat,
    updateLeadFormWithCompat,
} from '../src/lib/lead-forms-column-compat.ts'

test('insertLeadFormWithCompat retries without optional missing Meta columns', async () => {
    const attempts = []
    const responses = [
        {
            data: null,
            error: { message: 'column lead_forms.meta_capi_access_token does not exist' },
        },
        {
            data: null,
            error: { message: "Could not find the 'meta_capi_dataset_id' column of 'lead_forms' in the schema cache" },
        },
        {
            data: { id: 'form-1', title: 'Demo form' },
            error: null,
        },
    ]

    const supabase = {
        from(table) {
            assert.equal(table, 'lead_forms')

            return {
                insert(payload) {
                    attempts.push({ ...payload })

                    return {
                        select() {
                            return {
                                single: async () => responses.shift(),
                            }
                        },
                    }
                },
            }
        },
    }

    const result = await insertLeadFormWithCompat(supabase, {
        title: 'Demo form',
        meta_capi_access_token: 'token',
        meta_capi_dataset_id: 'dataset',
        facebook_purchase_value: 699,
    })

    assert.equal(result.error, null)
    assert.equal(result.data.id, 'form-1')
    assert.equal(attempts.length, 3)
    assert.equal(attempts[0].meta_capi_access_token, 'token')
    assert.ok(!('meta_capi_access_token' in attempts[1]))
    assert.equal(attempts[1].meta_capi_dataset_id, 'dataset')
    assert.ok(!('meta_capi_dataset_id' in attempts[2]))
    assert.equal(attempts[2].facebook_purchase_value, 699)
})

test('updateLeadFormWithCompat retries without optional missing Facebook toggle columns', async () => {
    const attempts = []
    const responses = [
        {
            data: null,
            error: { message: 'column lead_forms.send_qualified_to_facebook does not exist' },
        },
        {
            data: { id: 'form-1' },
            error: null,
        },
    ]

    const supabase = {
        from(table) {
            assert.equal(table, 'lead_forms')

            return {
                update(payload) {
                    attempts.push({ ...payload })

                    return {
                        eq(column, value) {
                            assert.equal(column, 'id')
                            assert.equal(value, 'form-1')

                            return {
                                select() {
                                    return {
                                        single: async () => responses.shift(),
                                    }
                                },
                            }
                        },
                    }
                },
            }
        },
    }

    const result = await updateLeadFormWithCompat(supabase, 'form-1', {
        title: 'Updated title',
        send_qualified_to_facebook: true,
    })

    assert.equal(result.error, null)
    assert.equal(result.data.id, 'form-1')
    assert.equal(attempts.length, 2)
    assert.equal(attempts[0].send_qualified_to_facebook, true)
    assert.ok(!('send_qualified_to_facebook' in attempts[1]))
    assert.equal(attempts[1].title, 'Updated title')
})
