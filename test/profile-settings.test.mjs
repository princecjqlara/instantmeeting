import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_PROFILE_SETTINGS, normalizeProfileSettings } from '../src/lib/profile-settings.ts'

test('DEFAULT_PROFILE_SETTINGS includes lead pipeline and Meta CAPI defaults', () => {
    assert.deepEqual(DEFAULT_PROFILE_SETTINGS.leads_pipeline_stages, [
        'prospect',
        'qualified',
        'unqualified',
        'sold',
    ])
    assert.equal(DEFAULT_PROFILE_SETTINGS.meta_capi_access_token, '')
    assert.equal(DEFAULT_PROFILE_SETTINGS.meta_capi_dataset_id, '')
})

test('normalizeProfileSettings fills in missing lead pipeline and Meta CAPI fields', () => {
    const settings = normalizeProfileSettings(null, { fallbackName: 'Host', fallbackTimezone: 'UTC' })

    assert.deepEqual(settings.leads_pipeline_stages, ['prospect', 'qualified', 'unqualified', 'sold'])
    assert.equal(settings.meta_capi_access_token, '')
    assert.equal(settings.meta_capi_dataset_id, '')
})

test('normalizeProfileSettings normalizes custom pipeline stages and trims Meta CAPI fields', () => {
    const settings = normalizeProfileSettings({
        name: 'Host',
        leads_pipeline_stages: [' Prospect ', 'qualified', '', 'sold', 'Qualified'],
        meta_capi_access_token: '  token-123  ',
        meta_capi_dataset_id: '  dataset-456  ',
    })

    assert.deepEqual(settings.leads_pipeline_stages, ['prospect', 'qualified', 'sold'])
    assert.equal(settings.meta_capi_access_token, 'token-123')
    assert.equal(settings.meta_capi_dataset_id, 'dataset-456')
})
