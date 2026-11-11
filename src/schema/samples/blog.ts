import { isWebsiteDocument } from '../types'
import blogData from './blog.json'

const sample: unknown = blogData

if (!isWebsiteDocument(sample)) {
  throw new Error('The blog sample does not match the WebsiteDocument schema.')
}

export const blogSample = sample
