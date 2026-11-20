import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null; }

/** Shows the crash instead of a blank white page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin CMS crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ maxWidth: 760, margin: '60px auto', padding: 24 }}>
        <div className="alert" role="alert">
          <strong>This page failed to load.</strong>
          <div style={{ marginTop: 8 }}>{error.message}</div>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--muted)' }}>{error.stack}</pre>
        <button className="btn" onClick={() => { this.setState({ error: null }); window.location.assign('/'); }}>Go to dashboard</button>
      </div>
    );
  }
}
