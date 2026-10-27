import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Auth from "./Auth.jsx";

function Root() {
  const [session, setSession] = useState(() => {
    try {
      const token = localStorage.getItem("smartEnergyToken");
      const userText = localStorage.getItem("smartEnergyUser");

      if (!token || !userText) return null;

      return {
        token,
        user: JSON.parse(userText),
      };
    } catch {
      localStorage.removeItem("smartEnergyToken");
      localStorage.removeItem("smartEnergyUser");
      return null;
    }
  });

  function handleLogin(result) {
    localStorage.setItem("smartEnergyToken", result.token);
    localStorage.setItem("smartEnergyUser", JSON.stringify(result.user));
    setSession({
      token: result.token,
      user: result.user,
    });
  }

  function handleLogout() {
    localStorage.removeItem("smartEnergyToken");
    localStorage.removeItem("smartEnergyUser");
    setSession(null);
  }

  if (!session) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <App
      user={session.user}
      token={session.token}
      onLogout={handleLogout}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
