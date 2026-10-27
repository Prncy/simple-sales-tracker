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
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#f6f7fb", color: "#202235" }}>
          <section style={{ maxWidth: 520, padding: 28, background: "#fff", border: "1px solid #e5e7ef", borderRadius: 16 }}>
            <h1 style={{ marginTop: 0 }}>Stockwise couldn’t load</h1>
            <p>The app encountered a JavaScript error. Reload the page, or share the error details below so it can be diagnosed.</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "any", padding: 12, borderRadius: 8, background: "#f6f7fb", fontSize: 12 }}>{this.state.error.message}</pre>
            <button onClick={() => window.location.reload()} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#6254e7", color: "#fff", fontWeight: 700 }}>Reload app</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
