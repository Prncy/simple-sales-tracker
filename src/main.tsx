import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Stockwise failed to render:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-page">
          <section className="error-card" role="alert">
            <div className="error-mark">!</div>
            <p className="eyebrow">STOCKWISE · RECOVERY</p>
            <h1>Something didn’t load correctly.</h1>
            <p>Try reloading the app. If the problem continues, share the technical detail below.</p>
            <pre>{this.state.error.message}</pre>
            <button className="primary-button" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById("root");

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
} else {
  document.body.innerHTML = "<main style='font-family:system-ui;padding:2rem'>Stockwise could not find its app root. Please reload the page.</main>";
}
