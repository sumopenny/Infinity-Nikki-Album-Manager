import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloudRequest } from '../../src/utils/resonance/cloudClient'
import { getWardrobeHead } from '../../src/utils/wardrobe/wardrobeCloudClient'
import {
  annotateDiagnosticError,
  trackDiagnostic
} from '../../src/utils/errorReporting/errorReporter'

vi.mock('../../src/utils/errorReporting/errorReporter', () => ({
  annotateDiagnosticError: vi.fn(),
  trackDiagnostic: vi.fn()
}))

const user = { id: 'private-account', username: 'private-name' }
const endpoints = [
  {
    path: '/api/resonance/cloud',
    request: () => cloudRequest('snapshot', user),
    response: { revision: 0, updated_at: 0, active_snapshot: null, records: [] }
  },
  {
    path: '/api/wardrobe/cloud',
    request: () => getWardrobeHead(user),
    response: { revision: 0, updated_at: 0, active_snapshot: null, summary: null }
  }
]

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('shared cloud transport diagnostics after merging', () => {
  it.each(endpoints)(
    'retains diagnostics for $path without recording account data',
    async (endpoint) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(endpoint.response)))
      await expect(endpoint.request()).resolves.toEqual(endpoint.response)
      expect(trackDiagnostic).toHaveBeenCalledWith(
        'network',
        'request-complete',
        expect.objectContaining({ endpoint: endpoint.path, method: 'GET', status: 200 })
      )
      expect(JSON.stringify(vi.mocked(trackDiagnostic).mock.calls)).not.toMatch(
        /private-account|private-name|action=/
      )
    }
  )

  it.each(endpoints)(
    'retains the network cause and diagnostic annotation for $path',
    async (endpoint) => {
      const cause = new TypeError('Failed to fetch')
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause))
      await expect(endpoint.request()).rejects.toMatchObject({ message: 'NETWORK', cause })
      expect(annotateDiagnosticError).toHaveBeenCalledWith(
        cause,
        expect.objectContaining({
          stage: 'network',
          context: expect.objectContaining({ endpoint: endpoint.path })
        })
      )
    }
  )
})
