// Templates offered in the gallery. Each one is checked with
// validateTemplate when the app loads; a template with issues is left out
// (and reported in the console), so the editor never opens a broken one.

import { isWebsiteDocument } from '../schema/types'
import type { WebsiteDocument } from '../schema/types'
import { validateTemplate } from './validateTemplate'
import agency from './agency.json'
import blog from './blog.json'
import portfolio from './portfolio.json'
import restaurant from './restaurant.json'
import saas from './saas.json'

export interface WebsiteTemplate {
  /** File name, also the id prefix of its nodes. */
  id: string
  name: string
  description: string
  website: WebsiteDocument
}

interface TemplateSource {
  id: string
  name: string
  description: string
  website: unknown
}

const sources: TemplateSource[] = [
  {
    id: 'saas',
    name: 'Startup landing',
    description: 'Features, pricing and testimonials for a software product.',
    website: saas,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'A personal site with projects, an about section and contact.',
    website: portfolio,
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'A featured story, latest articles, topics and a newsletter.',
    website: blog,
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Menu favourites, a photo gallery, opening hours and a map.',
    website: restaurant,
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Services, client quotes and the team of a creative studio.',
    website: agency,
  },
]

function loadTemplate(source: TemplateSource): WebsiteTemplate | null {
  const issues = validateTemplate(source.website, { idPrefix: source.id })
  if (issues.length > 0 || !isWebsiteDocument(source.website)) {
    console.warn(`Template "${source.id}" is not offered:`, issues)
    return null
  }
  return { ...source, website: source.website }
}

export const websiteTemplates: readonly WebsiteTemplate[] = sources
  .map(loadTemplate)
  .filter((template): template is WebsiteTemplate => template !== null)
