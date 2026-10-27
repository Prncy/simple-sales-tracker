import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Store } from "lucide-react";

type AuthMode = "signin" | "signup";

export default function App() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [welcome, setWelcome] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Phase 1 UI only: authentication will be connected to Supabase in Phase 2.
    setWelcome(true);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setWelcome(false);
  }

  if (welcome) {
    return (
      <main className="welcome-page">
        <section className="welcome-card">
          <div className="brand-icon"><Store size={24} /></div>
          <p className="eyebrow">STOCKWISE · STOCK & SALES TRACKER</p>
          <h1>Welcome{name.trim() ? `, ${name.trim()}` : " aboard"}!</h1>
          <p className="welcome-copy">
            You’ve reached the welcome screen. Your account isn’t connected yet—we’ll add real sign-in in the next phase.
          </p>
          <button className="primary-button" onClick={() => { setWelcome(false); setPassword(""); }}>
            Back to {mode === "signup" ? "sign up" : "sign in"} <ArrowRight size={17} />
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-icon"><Store size={24} /></div>
        <p className="eyebrow">STOCKWISE · STOCK & SALES TRACKER</p>
        <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-description">
          {mode === "signup"
            ? "Start keeping your business sales organized."
            : "Sign in to continue to your workspace."}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Your name
              <input type="text" value={name} onChange={(event) => setName(event.target.value)}
                placeholder="Your name" autoComplete="name" required />
            </label>
          )}
          <label>
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com" autoComplete="email" required />
          </label>
          <label>
            Password
            <span className="password-field">
              <input type={showPassword ? "text" : "password"} value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6} required />
              <button className="password-toggle" type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <button className="primary-button" type="submit">
            {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={17} />
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to Stockwise?"}{" "}
          <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="phase-note">Phase 1 preview · Authentication will be connected in Phase 2</p>
      </section>
    </main>
  );
}
