import { useState } from "react";
import "./Auth.css";

const API_URL = `${
  (import.meta.env.VITE_API_URL || "http://localhost:5001").replace(/\/$/, "")
}/api`;

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "login" : "register";

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(mode === "register" ? { name: name.trim() } : {}),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "Authentication failed. Please try again."
        );
      }

      if (!result.token || !result.user) {
        throw new Error("The server returned an invalid login response.");
      }

      onLogin(result);
    } catch (err) {
      console.error("Authentication error:", err);

      setError(
        err.message ||
          "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-logo">
            ⚡ Smart<span>Energy</span>
          </div>

          <h1>Understand your energy. Power a smarter home.</h1>

          <p>
            Monitor electricity consumption, explore AI-powered
            predictions, and discover ways to save energy.
          </p>

          <div className="auth-feature">
            <span>📊</span>
            <div>
              <strong>Consumption insights</strong>
              <p>Understand your monthly electricity usage.</p>
            </div>
          </div>

          <div className="auth-feature">
            <span>🔮</span>
            <div>
              <strong>Smart predictions</strong>
              <p>Explore forecasts and estimated electricity bills.</p>
            </div>
          </div>

          <div className="auth-feature">
            <span>🌱</span>
            <div>
              <strong>Energy-saving tips</strong>
              <p>Find practical ways to improve efficiency.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-logo">
            ⚡ Smart<span>Energy</span>
          </div>

          <p className="auth-eyebrow">YOUR ENERGY DASHBOARD</p>

          <h2>
            {mode === "login" ? "Welcome back!" : "Create your account"}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to continue to your dashboard."
              : "Register to get started with SmartEnergy."}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "selected" : ""}
              onClick={() => changeMode("login")}
            >
              Login
            </button>

            <button
              type="button"
              className={mode === "register" ? "selected" : ""}
              onClick={() => changeMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  minLength={2}
                  maxLength={80}
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
                maxLength={254}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </label>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in →"
                  : "Create account →"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login"
              ? "New to SmartEnergy?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() =>
                changeMode(mode === "login" ? "register" : "login")
              }
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <p className="auth-footer">
            SmartEnergy · AI-Based Electricity Consumption Predictor
          </p>
        </div>
      </section>
    </main>
  );
}

