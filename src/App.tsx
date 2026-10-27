import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  PackageCheck,
  Store,
  TrendingUp,
} from "lucide-react";

type AuthMode = "signin" | "signup";

export default function App() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [previewNotice, setPreviewNotice] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewNotice(true);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPreviewNotice(false);
  }

  return (
    <main className="app-shell">
      <section className="story-panel" aria-label="About Stockwise">
        <div className="story-top">
          <a className="brand" href="#home" aria-label="Stockwise home">
            <span className="brand-mark"><Store size={21} strokeWidth={2.4} /></span>
            <span>stockwise<span className="brand-period">.</span></span>
          </a>
          <span className="preview-pill"><span /> Preview version</span>
        </div>

        <div className="story-content">
          <p className="kicker"><span className="kicker-line" /> A clearer view of your business</p>
          <h1>Know your stock.<br /><span>Own your numbers.</span></h1>
          <p className="story-description">
            A simpler way to keep track of what comes in, what goes out, and how your business is doing.
          </p>

          <div className="dashboard-preview" aria-label="Illustrative sales overview">
            <div className="preview-heading">
              <div>
                <span className="mini-label">YOUR BUSINESS AT A GLANCE</span>
                <h2>Sales overview</h2>
              </div>
              <span className="preview-calendar">This week <span>⌄</span></span>
            </div>
            <div className="metric-row">
              <div className="metric-card">
                <span className="metric-icon violet"><TrendingUp size={17} /></span>
                <span className="metric-label">Sales tracked</span>
                <strong>Stay on top</strong>
                <small>Every sale in one place</small>
              </div>
              <div className="metric-card">
                <span className="metric-icon mint"><PackageCheck size={17} /></span>
                <span className="metric-label">Stock control</span>
                <strong>Know what’s left</strong>
                <small>Fewer stock surprises</small>
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-copy">
                <span className="metric-label">A clearer picture</span>
                <strong>Small details. Better decisions.</strong>
              </div>
              <div className="chart-visual" aria-hidden="true">
                <span style={{ height: "30%" }} />
                <span style={{ height: "46%" }} />
                <span style={{ height: "39%" }} />
                <span style={{ height: "62%" }} />
                <span style={{ height: "53%" }} />
                <span style={{ height: "78%" }} />
                <span style={{ height: "94%" }} />
              </div>
            </div>
            <div className="preview-foot"><span><Check size={13} /> Built for everyday business</span><span>Stockwise preview</span></div>
          </div>
        </div>

        <div className="story-footer">
          <span>Simple tools for steadier business.</span>
          <span>© 2026 Stockwise</span>
        </div>
        <div className="decor-orb decor-orb-one" />
        <div className="decor-orb decor-orb-two" />
      </section>

      <section className="form-panel" id="home">
        <div className="mobile-brand brand">
          <span className="brand-mark"><Store size={21} strokeWidth={2.4} /></span>
          <span>stockwise<span className="brand-period">.</span></span>
        </div>

        <div className="auth-wrap">
          {previewNotice ? (
            <div className="notice-card" role="status">
              <div className="notice-icon"><Check size={23} /></div>
              <p className="kicker">PREVIEW MODE</p>
              <h2>You’re in the right place.</h2>
              <p>
                The Stockwise interface preview is working. Account creation and sign-in are not active yet, so no account has been created and no data has been saved.
              </p>
              <button className="primary-button" onClick={() => setPreviewNotice(false)}>
                Back to {mode === "signup" ? "sign up" : "sign in"} <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="form-heading">
                <span className="form-icon"><BarChart3 size={21} /></span>
                <p className="kicker">{mode === "signup" ? "GET STARTED" : "GOOD TO SEE YOU"}</p>
                <h2>{mode === "signup" ? "Make business clearer." : "Welcome back."}</h2>
                <p>{mode === "signup" ? "Create your Stockwise profile to preview the experience." : "Enter your details to preview the sign-in experience."}</p>
              </div>

              <form className="auth-form" onSubmit={submit}>
                {mode === "signup" && (
                  <label>
                    Your name
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Alex Banda"
                      autoComplete="name"
                      required
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password
                  <span className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 6 characters"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      minLength={6}
                      required
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <button className="primary-button" type="submit">
                  {mode === "signup" ? "Create preview profile" : "Preview sign in"} <ArrowRight size={17} />
                </button>
              </form>

              <div className="secure-note"><span className="secure-dot" /> Demo only · Your details are not sent or saved</div>
              <p className="auth-switch">
                {mode === "signup" ? "Already have a profile?" : "New to Stockwise?"}{" "}
                <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? "Sign in" : "Create an account"}
                </button>
              </p>
            </>
          )}
        </div>
        <p className="mobile-footer">Stockwise · A clearer view of your business</p>
      </section>
    </main>
  );
}
