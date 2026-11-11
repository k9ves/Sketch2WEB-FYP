import { isWebsiteDocument } from '../types'
import portfolioData from './portfolio.json'

const sample: unknown = portfolioData

if (!isWebsiteDocument(sample)) {
  throw new Error(
    'The portfolio sample does not match the WebsiteDocument schema.',
  )
}

export const portfolioSample = sample
