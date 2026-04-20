import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('host leads page places filters before the pipeline and keeps lead summary directly below it', () => {
    const source = readFileSync(new URL('../src/app/host/leads/page.tsx', import.meta.url), 'utf8')

    const filtersIndex = source.indexOf('<section className={styles.filtersSection}>')
    const pipelineIndex = source.indexOf('<section className={styles.pipelineSection}>')
    const summaryIndex = source.indexOf('Lead Summary Table')
    const submissionsIndex = source.indexOf('Lead Form Submissions')

    assert.notEqual(filtersIndex, -1)
    assert.notEqual(pipelineIndex, -1)
    assert.notEqual(summaryIndex, -1)
    assert.notEqual(submissionsIndex, -1)

    assert.ok(filtersIndex < pipelineIndex, 'filters should render before the pipeline section')
    assert.ok(pipelineIndex < summaryIndex, 'lead summary should render after the pipeline starts')
    assert.ok(summaryIndex < submissionsIndex, 'lead summary should render before lead form submissions')
    assert.ok(source.includes('Meta test event code'), 'host leads settings should expose the Meta test event code field')
})
