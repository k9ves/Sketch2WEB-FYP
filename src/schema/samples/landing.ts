import { isWebsiteDocument } from '../types'
import landingData from './landing.json'

const sample: unknown = landingData

if (!isWebsiteDocument(sample)) {
  throw new Error(
    'The landing sample does not match the WebsiteDocument schema.',
  )
}

export const landingSample = sample
