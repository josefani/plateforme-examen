import { AppProviders } from './app/providers'
import { AppRouter } from './router/app-router'

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}

export default App
