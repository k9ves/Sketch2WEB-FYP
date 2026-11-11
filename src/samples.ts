import blogSample from '../samples/blog.json'
import landingSample from '../samples/landing.json'
import portfolioSample from '../samples/portfolio.json'
import { isWebsiteDocument } from './schema/validate'
import type { WebsiteDocument } from './schema/types'

function validateSample(value: unknown, name: string): WebsiteDocument {
  if (!isWebsiteDocument(value)) {
    throw new Error(`The ${name} sample does not match the website schema.`)
  }
  return value
}

export const websiteSamples: Record<string, WebsiteDocument> = {
  landing: validateSample(landingSample, 'landing'),
  portfolio: validateSample(portfolioSample, 'portfolio'),
  blog: validateSample(blogSample, 'blog'),
}
