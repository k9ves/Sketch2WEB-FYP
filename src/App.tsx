import { Renderer } from './renderer/Renderer'
import { landingSample } from './schema/samples/landing'

function App() {
  const hero = landingSample.children.find((node) => node.type === 'hero')

  return (
    <main className="min-h-screen bg-white px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <p className="mb-8 text-sm font-medium uppercase tracking-wide text-slate-500">
          Landing sample · schema v{landingSample.version}
        </p>
        {hero ? <Renderer node={hero} /> : null}
      </div>
    </main>
  )
}

export default App
