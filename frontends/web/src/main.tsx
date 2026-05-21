import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#1a0a0a', color: '#ff6b6b',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'monospace', padding: '2rem'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>React Error</h1>
          <pre style={{
            whiteSpace: 'pre-wrap', maxWidth: '800px', fontSize: '0.85rem',
            background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px',
            lineHeight: 1.6
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
