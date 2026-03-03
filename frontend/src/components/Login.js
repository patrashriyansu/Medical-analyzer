import React, { useMemo, useState } from "react";
import "./Auth.css";

function Login({ onLoginSuccess }) {
  const isCapacitorApp = !!window?.Capacitor;
  const isLocalWeb = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const publicApiBase = "https://medical-analyzer-production-7dc4.up.railway.app";
  const defaultApiBase = process.env.REACT_APP_API_BASE_URL
    || (isLocalWeb ? localStorage.getItem("backend_url") : null)
    || (isCapacitorApp ? "http://10.0.2.2:8000" : (isLocalWeb ? "http://127.0.0.1:8000" : publicApiBase));
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const backendCandidates = useMemo(() => {
    const list = [];

    list.push(defaultApiBase);

    if (isCapacitorApp) {
      list.push("http://10.0.2.2:8000");
    } else if (isLocalWeb) {
      list.push("http://127.0.0.1:8000", "http://localhost:8000");
    }

    return [...new Set(list.filter(Boolean))];
  }, [defaultApiBase, isCapacitorApp, isLocalWeb]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = isSignUp ? "register" : "login";

    try {
      const payload = JSON.stringify(isSignUp ? { email, password, name } : { email, password });
      const request = async (base) => {
        const response = await fetch(`${base}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });

        const raw = await response.text();
        if (raw.trim().startsWith("<!DOCTYPE") || raw.trim().startsWith("<html")) {
          throw new Error("HTML_RESPONSE");
        }

        return { response, data: JSON.parse(raw), base };
      };

      let result = null;
      for (const base of backendCandidates) {
        try {
          result = await request(base);
          break;
        } catch (innerErr) {
          if (innerErr.message !== "HTML_RESPONSE" && !String(innerErr.message).includes("Failed to fetch")) {
            throw innerErr;
          }
        }
      }

      if (!result) {
        throw new Error(
          isCapacitorApp
            ? "Cannot connect to backend. Make sure backend runs with --host 0.0.0.0 and phone and PC are on same Wi-Fi."
            : "Cannot connect to backend. Check deployed backend URL/environment settings."
        );
      }

      const { response, data } = result;
      if (!response.ok) throw new Error(data.detail || "Error occurred");

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_name", data.user_name);
      localStorage.setItem("backend_url", result.base);
      onLoginSuccess({ name: data.user_name, email, token: data.access_token });
    } catch (err) {
      if (err?.message?.includes("Failed to fetch")) {
        setError("Cannot connect to backend. Check backend URL and ensure server is reachable.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-content-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>MediTrack</h1>
            <p>Clinical report intelligence and preventive planning</p>
          </div>

          <div className="auth-toggle">
            <button
              className={`toggle-btn ${!isSignUp ? "active" : ""}`}
              onClick={() => setIsSignUp(false)}
              type="button"
            >
              Login
            </button>
            <button
              className={`toggle-btn ${isSignUp ? "active" : ""}`}
              onClick={() => setIsSignUp(true)}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {isSignUp && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="auth-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="auth-button primary" disabled={loading}>
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
