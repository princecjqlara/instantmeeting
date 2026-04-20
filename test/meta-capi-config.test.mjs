import test from 'node:test'
import assert from 'node:assert/strict'

import { selectMetaCapiConfig } from '../src/lib/meta-capi-config.ts'

test('selectMetaCapiConfig prefers an organizer config when multiple users have credentials', () => {
    const config = selectMetaCapiConfig([
        {
            role: 'tenant',
            meta_capi_access_token: 'tenant-token',
            meta_capi_dataset_id: 'tenant-dataset',
            meta_capi_test_event_code: 'TENANTTEST',
        },
        {
            role: 'organizer',
            meta_capi_access_token: 'organizer-token',
            meta_capi_dataset_id: 'organizer-dataset',
            meta_capi_test_event_code: 'ORGTEST',
        },
    ])

    assert.deepEqual(config, {
        accessToken: 'organizer-token',
        datasetId: 'organizer-dataset',
        testEventCode: 'ORGTEST',
    })
})

test('selectMetaCapiConfig falls back to a tenant config when no organizer config is available', () => {
    const config = selectMetaCapiConfig([
        {
            role: 'organizer',
            meta_capi_access_token: '   ',
            meta_capi_dataset_id: '   ',
        },
        {
            role: 'tenant',
            meta_capi_access_token: 'tenant-token',
            meta_capi_dataset_id: 'tenant-dataset',
            meta_capi_test_event_code: 'TENANTTEST',
        },
    ])

    assert.deepEqual(config, {
        accessToken: 'tenant-token',
        datasetId: 'tenant-dataset',
        testEventCode: 'TENANTTEST',
    })
})

test('selectMetaCapiConfig ignores incomplete rows', () => {
    const config = selectMetaCapiConfig([
        {
            role: 'tenant',
            meta_capi_access_token: 'tenant-token',
            meta_capi_dataset_id: null,
        },
    ])

    assert.equal(config, null)
})
