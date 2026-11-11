import { Renderer } from './renderer/Renderer'
import { landingSample } from './schema/samples/landing'

function App() {
  const navbar = landingSample.children.find((node) => node.type === 'navbar')
  const hero = landingSample.children.find((node) => node.type === 'hero')
  const workSection = landingSample.children.find(
    (node) => node.id === 'featured-work',
  )
  const footer = landingSample.children.find((node) => node.type === 'footer')

  return (
    <div className="min-h-screen bg-white">
      {navbar ? <Renderer node={navbar} /> : null}
      <main className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-sm font-medium uppercase tracking-wide text-slate-500">
            Landing sample · schema v{landingSample.version}
          </p>
          {hero ? <Renderer node={hero} /> : null}
        </div>
        {workSection ? <Renderer node={workSection} /> : null}
      </main>
      {footer ? <Renderer node={footer} /> : null}
    </div>
  )
}

export default App
