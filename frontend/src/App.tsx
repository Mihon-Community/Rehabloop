import { Link } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { SafetyBanner } from './components/SafetyBanner';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>RehabLoop</h1>
          <p className="meta">AI-assisted rehabilitation movement intelligence — prototype</p>
        </div>
        <span className="simulated-badge" title="Fixture mode is never real inference">
          DEMO BUILD
        </span>
      </header>

      <nav className="app-nav" aria-label="Screens">
        <Link to="/">Sign in</Link>
        <Link to="/home">Patient home</Link>
        <Link to="/protocols/demo">Protocol</Link>
        <Link to="/setup">Start session</Link>
        <Link to="/sessions/demo/result">Result</Link>
        <Link to="/clinician">Clinician</Link>
        <Link to="/twin">Recovery Twin</Link>
      </nav>

      <main>
        <AppRoutes />
      </main>
      <footer className="meta" style={{ marginTop: '2rem' }}>
        <SafetyBanner />
      </footer>
    </div>
  );
}
