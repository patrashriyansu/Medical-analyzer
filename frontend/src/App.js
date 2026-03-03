import React, { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Login from "./components/Login";
import HealthReminder from "./components/HealthReminder";
import Header from "./components/Header";
import Hero from "./components/Hero";
import "./App.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function App() {
  const isCapacitorApp = !!window?.Capacitor;
  const isLocalWeb = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const publicApiBase = "https://medical-analyzer-production-7dc4.up.railway.app";
  const API_BASE = process.env.REACT_APP_API_BASE_URL
    || (isLocalWeb ? localStorage.getItem("backend_url") : null)
    || (isCapacitorApp ? "http://10.0.2.2:8000" : (isLocalWeb ? "http://127.0.0.1:8000" : publicApiBase));
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceResponse, setVoiceResponse] = useState("");
  const [personalizedPlan, setPersonalizedPlan] = useState(null);
  const [riskLevel, setRiskLevel] = useState(null);
  const [trends, setTrends] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [showTrends, setShowTrends] = useState(false);
  const [reportExplanation, setReportExplanation] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // ✨ New Feature States
  const [emergencyAlerts, setEmergencyAlerts] = useState(null);
  const [familyProfiles, setFamilyProfiles] = useState([]);
  const [familyMemberName, setFamilyMemberName] = useState("");
  const [familyRelation, setFamilyRelation] = useState("self");
  const [healthTrends, setHealthTrends] = useState(null);
  const [localization, setLocalization] = useState(null);

  // 🎯 NEW: Feature Page Navigation
  const [currentFeaturePage, setCurrentFeaturePage] = useState(null); // null = dashboard, or feature name

  const resultsRef = useRef(null);

  const deriveTrendDirection = (items) => {
    if (!items || items.length === 0) return "No Data";
    if (items.length === 1) return "Baseline Captured";
    const first = items[0]?.health_score ?? 0;
    const last = items[items.length - 1]?.health_score ?? 0;
    if (last > first) return "Improving";
    if (last < first) return "Declining";
    return "Stable";
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userName = localStorage.getItem("user_name");
    if (token && userName) {
      setUser({ name: userName, token });
    }
  }, []);

  const handleInvalidToken = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_name");
    setUser(null);
    setResult(null);
    alert("Session expired or invalid token. Please login again.");
  };

  const handleUpload = async () => {
    if (!file) return alert("Select PDF first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/upload-report`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${user.token}`
        },
        body: formData,
      });

      if (response.status === 401) {
        handleInvalidToken();
        setLoading(false);
        return;
      }

      const text = await response.text();
      console.log("Backend response:", text);

      if (!response.ok) {
        throw new Error(text);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid API response (received HTML). Restart frontend after proxy change and ensure backend runs on port 8000.");
      }
      setResult(data);

      // 🎯 Get Personalized Plan
      const planResponse = await fetch(`${API_BASE}/personalized-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          analysis: data.analysis,
          health_score: data.health_score,
          risk_flags: []
        })
      });
      const planData = await planResponse.json();
      setPersonalizedPlan(planData.personalized_plan);

      // 🚨 Get Risk Level
      const riskResponse = await fetch(`${API_BASE}/risk-level`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          analysis: data.analysis,
          health_score: data.health_score,
          risk_flags: []
        })
      });
      const riskData = await riskResponse.json();
      setRiskLevel(riskData);

      // 💾 Save Trend
      const currentDate = new Date().toISOString().split('T')[0];
      await fetch(`${API_BASE}/trends/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          user_email: user.name,
          analysis: data.analysis,
          health_score: data.health_score,
          date: currentDate
        })
      });

      // 📊 Get Trends
      const trendsResponse = await fetch(`${API_BASE}/trends/get/${user.name}`, {
        headers: {
          "Authorization": `Bearer ${user.token}`
        }
      });
      const trendsData = await trendsResponse.json();
      setTrends(trendsData);

      // 📖 Get AI Report Explanation
      const explainResponse = await fetch(`${API_BASE}/explain-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          analysis: data.analysis,
          health_score: data.health_score,
          explanation: data.explanation
        })
      });
      const explainData = await explainResponse.json();
      setReportExplanation(explainData);

      setLoading(false);
      setChatMessages([]);
    } catch (error) {
      setLoading(false);
      console.error(error);
      if (error?.message?.includes("Failed to fetch")) {
        alert("Upload failed: Cannot connect to backend. Ensure backend is running on port 8000.");
      } else {
        alert("Upload failed: " + error.message);
      }
    }
  };
  const translateToHindi = (text) => {
    return text
      .replace("Medical Report Summary", "चिकित्सा रिपोर्ट सारांश")
      .replace("Abnormal Findings", "असामान्य परिणाम")
      .replace("Medical Insights", "चिकित्सा जानकारी")
      .replace("Recommendations", "सुझाव")
      .replace("Disclaimer", "अस्वीकरण")
      .replace("High", "उच्च")
      .replace("Low", "कम")
      .replace("Normal", "सामान्य");
  };

  const chartData = result?.analysis
    ? {
      labels: Object.keys(result.analysis),
      datasets: [
        {
          label: "Lab Values",
          data: Object.values(result.analysis).map((item) => item.value),
          backgroundColor: Object.values(result.analysis).map((item) =>
            item.status === "High"
              ? "#e74c3c"
              : item.status === "Low"
                ? "#f39c12"
                : "#2ecc71"
          ),
        },
      ],
    }
    : null;

  // PDF Download Function
  const downloadPDF = async () => {
    const element = resultsRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * width) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, width, imgHeight);
      heightLeft -= height;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, width, imgHeight);
        heightLeft -= height;
      }

      pdf.save(`Medical-Report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF');
    }
  };

  // Voice Input Function
  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported in your browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.start();
    setListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setVoiceQuery(transcript);
      getVoiceResponse(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  // Get AI Response for Voice Query
  const getVoiceResponse = async (query) => {
    try {
      // Try new voice consultation endpoint first
      const response = await fetch(`${API_BASE}/voice-consultation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          query,
          analysis: result?.analysis || {}
        })
      });

      const data = await response.json();
      setVoiceResponse(data.response || "I couldn't understand that. Please try again.");

      // Text-to-Speech
      const utterance = new SpeechSynthesisUtterance(data.response);
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Voice query error:', error);
    }
  };

  // 💬 Chat with AI about Report
  const handleChatMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message to chat
    const newMessages = [...chatMessages, { role: "user", content: message }];
    setChatMessages(newMessages);

    try {
      const response = await fetch(`${API_BASE}/chat-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          message,
          analysis: result?.analysis || {},
          health_score: result?.health_score || 0
        })
      });

      const data = await response.json();
      setChatMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  // ✨ FEATURE 1: EMERGENCY ALERT DETECTION
  const checkEmergencyAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE}/emergency-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          message: "Check alerts",
          analysis: result?.analysis || {},
          health_score: result?.health_score || 0
        })
      });
      const data = await response.json();
      setEmergencyAlerts(data);
      setCurrentFeaturePage("emergency-alerts"); // Navigate to page
    } catch (error) {
      console.error('Emergency alert error:', error);
    }
  };

  // ✨ FEATURE 2: FAMILY HEALTH DASHBOARD
  const saveFamilyProfile = async () => {
    if (!familyMemberName.trim()) return alert("Enter family member name");
    try {
      await fetch(`${API_BASE}/family/save-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          user_email: user.name,
          family_member_name: familyMemberName,
          relation: familyRelation,
          analysis: result?.analysis || {},
          health_score: result?.health_score || 0
        })
      });
      alert("✅ Family member profile saved!");
      setFamilyMemberName("");
      loadFamilyProfiles();
    } catch (error) {
      console.error('Error saving family profile:', error);
    }
  };

  const loadFamilyProfiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/family/get-profiles/${user.name}`, {
        headers: { "Authorization": `Bearer ${user.token}` }
      });
      const data = await response.json();
      setFamilyProfiles(data);
      setCurrentFeaturePage("family-dashboard"); // Navigate to page
    } catch (error) {
      console.error('Error loading family profiles:', error);
    }
  };

  // ✨ FEATURE 3: HEALTH TRENDS
  const saveHealthTrend = async () => {
    try {
      await fetch(`${API_BASE}/trends/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          user_email: user.name,
          analysis: result?.analysis || {},
          health_score: result?.health_score || 0,
          date: new Date().toISOString().split('T')[0]
        })
      });
      loadHealthTrends();
    } catch (error) {
      console.error('Error saving trend:', error);
    }
  };

  const loadHealthTrends = async () => {
    try {
      const response = await fetch(`${API_BASE}/trends/get/${user.name}`, {
        headers: { "Authorization": `Bearer ${user.token}` }
      });
      const data = await response.json();
      setHealthTrends(data);
      setCurrentFeaturePage("health-trends"); // Navigate to page
    } catch (error) {
      console.error('Error loading trends:', error);
    }
  };

  // ✨ FEATURE 4: LOCALIZATION
  const loadLocalization = async () => {
    try {
      const response = await fetch(`${API_BASE}/localize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          language: language,
          analysis: result?.analysis || {},
          health_score: result?.health_score || 0
        })
      });
      const data = await response.json();
      setLocalization(data);
      setCurrentFeaturePage("localization"); // Navigate to page
    } catch (error) {
      console.error('Error loading localization:', error);
    }
  };

  // 🎨 Dynamic Background Helper
  const getBackgroundClass = () => {
    if (!user) return "bg-auth";
    switch (currentFeaturePage) {
      case "emergency-alerts": return "bg-emergency";
      case "family-dashboard": return "bg-family";
      case "health-trends": return "bg-trends";
      case "localization": return "bg-localization";
      default: return result ? "bg-dashboard" : "bg-home";
    }
  };

  return (
    <>
      {!user ? (
        <Login onLoginSuccess={(userData) => {
          setUser(userData);
        }} />
      ) : (
        <div className={`app-container ${getBackgroundClass()}`}>
          <Header user={user} onLogout={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user_name");
            setUser(null);
            setResult(null);
          }} onOpenReminders={() => setReminderOpen(true)} />

          <main className="app-content">
            {/* 🎯 FEATURE PAGE: EMERGENCY ALERTS */}
            {currentFeaturePage === "emergency-alerts" && emergencyAlerts && (
              <div className="feature-page-view">
                <button className="back-btn" onClick={() => setCurrentFeaturePage(null)}>← Back to Dashboard</button>
                <div className="page-full-emergency-alerts">
                  <h2>🚨 Critical Biomarker Alerts</h2>

                  {emergencyAlerts.critical && emergencyAlerts.critical.length > 0 && (
                    <div className="critical-alerts">
                      <h3 className="alert-critical">🚨 CRITICAL ALERTS</h3>
                      {emergencyAlerts.critical.map((alert, idx) => (
                        <div key={idx} className="alert-item critical">
                          <strong>{alert.test}</strong> - {alert.message}
                          <p className="alert-action">Action: {alert.action}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {emergencyAlerts.warning && emergencyAlerts.warning.length > 0 && (
                    <div className="warning-alerts">
                      <h3 className="alert-warning">⚠️ WARNING ALERTS</h3>
                      {emergencyAlerts.warning.map((alert, idx) => (
                        <div key={idx} className="alert-item warning">
                          <strong>{alert.test}</strong> - {alert.message}
                          <p className="alert-action">Action: {alert.action}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {emergencyAlerts.notifications && (
                    <div className="alert-notifications">
                      <h3>📲 Notification Channels</h3>
                      <p>📧 {emergencyAlerts.notifications.email}</p>
                      <p>💬 {emergencyAlerts.notifications.whatsapp}</p>
                      <p>📱 {emergencyAlerts.notifications.sms}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🎯 FEATURE PAGE: FAMILY HEALTH DASHBOARD */}
            {currentFeaturePage === "family-dashboard" && familyProfiles && (
              <div className="feature-page-view">
                <button className="back-btn" onClick={() => setCurrentFeaturePage(null)}>← Back to Dashboard</button>
                <div className="page-full-family-dashboard">
                  <h2>👨‍👩‍👧 Genomic Cohort Monitoring</h2>

                  <div className="add-family-member">
                    <input
                      type="text"
                      placeholder="Family member name"
                      value={familyMemberName}
                      onChange={(e) => setFamilyMemberName(e.target.value)}
                    />
                    <select value={familyRelation} onChange={(e) => setFamilyRelation(e.target.value)}>
                      <option value="self">Self</option>
                      <option value="mother">Mother</option>
                      <option value="father">Father</option>
                      <option value="sibling">Sibling</option>
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                    </select>
                    <button onClick={saveFamilyProfile}>Add Member</button>
                  </div>

                  {familyProfiles.profiles && familyProfiles.profiles.length > 0 && (
                    <div className="family-profiles-list">
                      <h3>Family Members ({familyProfiles.family_count})</h3>
                      {familyProfiles.profiles.map((profile, idx) => (
                        <div key={idx} className="family-profile-card">
                          <div className="profile-header">
                            <strong>{profile.name}</strong>
                            <span className="relation-badge">{profile.relation}</span>
                          </div>
                          <div className="profile-score">Health Score: {profile.health_score}%</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {familyProfiles.genetic_prediction && (
                    <div className="genetic-prediction">
                      <h3>🧬 Genetic Analysis</h3>
                      <p>{familyProfiles.genetic_prediction}</p>
                      <p className="recommendation">{familyProfiles.recommendation}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🎯 FEATURE PAGE: HEALTH TRENDS ANALYSIS */}
            {currentFeaturePage === "health-trends" && healthTrends && healthTrends.trends && (
              <div className="feature-page-view">
                <button className="back-btn" onClick={() => setCurrentFeaturePage(null)}>← Back to Dashboard</button>
                <div className="page-full-health-trends">
                  <h2>📈 Longitudinal Data Analytics</h2>

                  <div className="trend-stats">
                    <div className="stat-box">
                      <span className="stat-label">Average Score</span>
                      <span className="stat-value">{healthTrends.average_score}%</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Latest Score</span>
                      <span className="stat-value">{healthTrends.latest_score}%</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Trend</span>
                      <span className="stat-value">{healthTrends.trend_direction || deriveTrendDirection(healthTrends.trends)}</span>
                    </div>
                  </div>

                  <div className="trend-prediction">
                    <h3>🎯 Prediction</h3>
                    <p>{healthTrends.prediction || (healthTrends.trends.length > 0 ? "Keep saving periodic metrics to build a stronger 6-month health projection." : "No trend history yet. Save current metrics to start prediction.")}</p>
                  </div>

                  {healthTrends.chart_data && healthTrends.chart_data.labels && healthTrends.chart_data.labels.length > 0 && (
                    <div className="trend-history-chart">
                      <h3>Score History</h3>
                      {healthTrends.chart_data.labels.map((date, idx) => (
                        <div key={idx} className="history-item">
                          <span className="history-date">{date}</span>
                          <div className="history-bar" style={{ width: (healthTrends.chart_data.scores[idx] || 0) + '%' }}>
                            <span className="history-score">{healthTrends.chart_data.scores[idx]}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!healthTrends.chart_data && healthTrends.trends.length > 0 && (
                    <div className="trend-history-chart">
                      <h3>Score History</h3>
                      {healthTrends.trends.map((entry, idx) => (
                        <div key={idx} className="history-item">
                          <span className="history-date">{entry.date}</span>
                          <div className="history-bar" style={{ width: (entry.health_score || 0) + '%' }}>
                            <span className="history-score">{entry.health_score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="trend-save-btn" onClick={saveHealthTrend}>📌 Save Current Metrics</button>
                </div>
              </div>
            )}

            {/* 🎯 FEATURE PAGE: LOCALIZATION & PERSONALIZATION */}
            {currentFeaturePage === "localization" && localization && (
              <div className="feature-page-view">
                <button className="back-btn" onClick={() => setCurrentFeaturePage(null)}>← Back to Dashboard</button>
                <div className="page-full-localization">
                  <h2>🌍 Localized Health Report ({localization.language.toUpperCase()})</h2>

                  <div className="personalization-message">
                    <p className="message-text">{localization.personalization_message}</p>
                  </div>

                  {localization.localized_analysis && Object.keys(localization.localized_analysis).length > 0 && (
                    <div className="localized-results">
                      <h3>📊 {localization.health_score_label}</h3>
                      {Object.entries(localization.localized_analysis).map(([key, val]) => (
                        <div key={key} className="localized-item">
                          <span className="test-name">{key}</span>
                          <span className="test-value">{val.value} {val.unit}</span>
                          <span className="test-status">{val.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {localization.dietary_preferences && (
                    <div className="preferences">
                      <h3>🍽️ Diet Preferences</h3>
                      {localization.dietary_preferences.map((pref, idx) => (
                        <button key={idx} className="pref-btn">{pref}</button>
                      ))}
                    </div>
                  )}

                  {localization.exercise_preferences && (
                    <div className="preferences">
                      <h3>🏃 Exercise Preferences</h3>
                      {localization.exercise_preferences.map((pref, idx) => (
                        <button key={idx} className="pref-btn">{pref}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🎯 MAIN DASHBOARD - Show when not on a feature page */}
            {!currentFeaturePage && (
              <>
                <Hero onAnalyzeClick={() => document.getElementById('file-input')?.click()} />
                <div className="upload-section">
                  <h2>🚀 Biomarker Data Ingestion</h2>
                  <div className="upload-area">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setFile(e.target.files[0])}
                      id="file-input"
                    />
                    <label htmlFor="file-input">
                      {file ? file.name : "Choose a PDF file or drag and drop"}
                    </label>
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    className="analyze-btn"
                  >
                    {loading ? "Analyzing..." : "Analyze Report"}
                  </button>
                </div>

                {/* 🌟 Advanced Features Section */}
                <div className="features-section">
                  <h2>✨ Advanced Features</h2>
                  <div className="features-grid">
                    {/* Feature 1: Location-aware diet suggestion */}
                    <div className="feature-card" onClick={result ? loadLocalization : null} style={{ cursor: result ? 'pointer' : 'default', opacity: result ? 1 : 0.6 }}>
                      <div className="feature-icon">🌍</div>
                      <h3>📍 Location-aware diet suggestion</h3>
                      <p>Generate personalized nutrition guidance based on region, language, and localized clinical context.</p>
                      <span className="feature-status">🟢 Active</span>
                      {result && <button className="feature-btn">View Diet Plan →</button>}
                    </div>

                    {/* Feature 2: Emergency Alert Detection */}
                    <div className="feature-card" onClick={result ? checkEmergencyAlerts : null} style={{ cursor: result ? 'pointer' : 'default', opacity: result ? 1 : 0.6 }}>
                      <div className="feature-icon">🚨</div>
                      <h3>Critical Biomarker Surveillance</h3>
                      <p>Automated monitoring for dangerous physiological thresholds with prioritized cross-channel clinical alerts.</p>
                      <span className="feature-status">🟢 Active</span>
                      {result && <button className="feature-btn">Check Alerts →</button>}
                    </div>

                    {/* Feature 3: Genetic Risk Simulation */}
                    <div className="feature-card" onClick={result ? loadFamilyProfiles : null} style={{ cursor: result ? 'pointer' : 'default', opacity: result ? 1 : 0.6 }}>
                      <div className="feature-icon">👨‍👩‍👧</div>
                      <h3>🧬 Genetic Risk Simulation</h3>
                      <p>Model hereditary health risk patterns using family-linked biomarker history and cohort baselines.</p>
                      <span className="feature-status">🟢 Active</span>
                      {result && <button className="feature-btn">Run Simulation →</button>}
                    </div>

                    {/* Feature 4: Predictive 6-Month Health Projection */}
                    <div className="feature-card" onClick={result ? loadHealthTrends : null} style={{ cursor: result ? 'pointer' : 'default', opacity: result ? 1 : 0.6 }}>
                      <div className="feature-icon">📈</div>
                      <h3>📈 Predictive 6-Month Health Projection</h3>
                      <p>Forecast your likely clinical trajectory over the next six months from longitudinal biomarker trends.</p>
                      <span className="feature-status">🟢 Active</span>
                      {result && <button className="feature-btn">View Projection →</button>}
                    </div>

                    {/* Feature 5: Voice-based AI Explanation */}
                    <div className="feature-card" onClick={result ? startVoiceInput : null} style={{ cursor: result ? 'pointer' : 'default', opacity: result ? 1 : 0.6 }}>
                      <div className="feature-icon">🎤</div>
                      <h3>🗣 Voice-based AI Explanation</h3>
                      <p>Ask questions by voice and get clear spoken AI explanations for report findings and risk context.</p>
                      <span className="feature-status">🟢 Active</span>
                      {result && <button className="feature-btn">Start Voice AI →</button>}
                    </div>
                  </div>
                </div>

                {result && (
                  <div className="results-section" ref={resultsRef}>
                    <div className="results-header">
                      <div>
                        <div className="language-toggle">
                          <button
                            className={language === "en" ? "active" : ""}
                            onClick={() => setLanguage("en")}
                          >
                            English
                          </button>
                          <button
                            className={language === "hi" ? "active" : ""}
                            onClick={() => setLanguage("hi")}
                          >
                            हिंदी
                          </button>
                        </div>
                      </div>
                      <div className="action-buttons">
                        <button className="voice-btn" onClick={startVoiceInput} disabled={listening}>
                          {listening ? "🎤 Listening..." : "🎤 Ask Questions"}
                        </button>
                        <button className="pdf-btn" onClick={downloadPDF}>
                          📥 Download PDF
                        </button>
                      </div>
                    </div>

                    {voiceQuery && (
                      <div className="voice-container">
                        <div className="voice-query">
                          <strong>Your Question:</strong> {voiceQuery}
                        </div>
                        {voiceResponse && (
                          <div className="voice-response">
                            <strong>AI Response:</strong> {voiceResponse}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 🚨 Risk Level Display */}
                    {riskLevel && (
                      <div className="risk-indicator">
                        <h3>{riskLevel.risk_level}</h3>
                        <p className="risk-recommendation">{riskLevel.recommendation}</p>
                        {riskLevel.risk_factors && riskLevel.risk_factors.length > 0 && (
                          <div className="risk-factors">
                            <strong>Risk Factors:</strong>
                            <ul>
                              {riskLevel.risk_factors.map((factor, idx) => (
                                <li key={idx}>{factor}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="health-score">
                      <h3>Clinical Wellness Index</h3>
                      <div className="score-circle">
                        {result.health_score}%
                      </div>
                    </div>

                    {/* 📊 Trends Display */}
                    {trends && trends.trends && trends.trends.length > 0 && (
                      <div className="trends-section">
                        <button className="trends-toggle" onClick={() => setShowTrends(!showTrends)}>
                          📈 {trends.trend_analysis}
                        </button>
                        {showTrends && (
                          <div className="trends-details">
                            <p><strong>Average Score:</strong> {trends.average_score}%</p>
                            <p><strong>Latest Score:</strong> {trends.latest_score}%</p>
                            <div className="trends-history">
                              {trends.trends.map((t, idx) => (
                                <div key={idx} className="trend-item">
                                  <span>{t.date}</span>
                                  <span className="trend-score">{t.health_score}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {chartData && (
                      <div className="chart-container">
                        <Bar data={chartData} />
                      </div>
                    )}

                    {/* 🥗 Personalized Plan Display */}
                    {personalizedPlan && (
                      <div className="personalized-plan">
                        <h3>Precision Therapeutic Regimen</h3>
                        {personalizedPlan.risk_type && (
                          <p className="timeline-text">
                            <strong>Risk Type:</strong> {personalizedPlan.risk_type.replace(/_/g, " ")}
                          </p>
                        )}

                        <div className="plan-grid">
                          {/* 🥗 Diet */}
                          <div className="plan-card diet-card">
                            <h4>🥗 Diet Suggestions</h4>
                            <ul>
                              {personalizedPlan.diet_suggestions?.length > 0 ? (
                                personalizedPlan.diet_suggestions.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))
                              ) : (
                                <li>AI is tailoring your nutrition plan...</li>
                              )}
                            </ul>
                          </div>

                          {/* 🏃 Exercise */}
                          <div className="plan-card exercise-card">
                            <h4>🏃 Exercise Plan</h4>
                            <ul>
                              {personalizedPlan.exercise_plan?.length > 0 ? (
                                personalizedPlan.exercise_plan.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))
                              ) : (
                                <li>Customizing your activity routine...</li>
                              )}
                            </ul>
                          </div>

                          {/* 🧪 Tests */}
                          <div className="plan-card tests-card">
                            <h4>🧪 Tests to Repeat</h4>
                            <ul>
                              {personalizedPlan.tests_to_repeat?.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>

                          {/* ⏰ Timeline */}
                          <div className="plan-card timeline-card">
                            <h4>⏰ Recheck Timeline</h4>
                            <p className="timeline-text">{personalizedPlan.recheck_timeline}</p>
                          </div>

                          <div className="plan-card tests-card">
                            <h4>Lifestyle Advice</h4>
                            <ul>
                              {personalizedPlan.lifestyle_advice?.length > 0 ? (
                                personalizedPlan.lifestyle_advice.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))
                              ) : (
                                <li>Building your lifestyle guidance...</li>
                              )}
                            </ul>
                          </div>

                          <div className="plan-card timeline-card">
                            <h4>30-Day Action Plan</h4>
                            <ul>
                              {personalizedPlan.action_plan_30_days?.length > 0 ? (
                                personalizedPlan.action_plan_30_days.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))
                              ) : (
                                <li>Generating your month-long plan...</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 💬 Chat Interface */}
                    <div className="chat-interface">
                      <button className="chat-toggle" onClick={() => setChatOpen(!chatOpen)}>
                        💬 Ask AI About Your Report
                      </button>
                      {chatOpen && (
                        <div className="chat-box">
                          <div className="chat-messages">
                            {chatMessages.map((msg, idx) => (
                              <div key={idx} className={`chat-message ${msg.role}`}>
                                <div className="message-bubble">{msg.content}</div>
                              </div>
                            ))}
                          </div>
                          <div className="chat-input-area">
                            <input
                              type="text"
                              placeholder="Ask about your health report..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleChatMessage(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                            <button onClick={(e) => {
                              const input = e.target.previousElementSibling;
                              handleChatMessage(input.value);
                              input.value = '';
                            }}>
                              Send
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 📖 Nova Report Explanation */}
                    {reportExplanation && (
                      <div className="nova-explanation-section">
                        <button
                          className="explanation-toggle"
                          onClick={() => setShowExplanation(!showExplanation)}
                        >
                          📖 {reportExplanation.source === "AI Analysis (Amazon Nova)" ? "🤖 AI-Powered" : ""} Report Analysis
                          <span className="toggle-indicator">{showExplanation ? "▼" : "▶"}</span>
                        </button>
                        {showExplanation && (
                          <div className="explanation-content">
                            <div className="explanation-badge">
                              {reportExplanation.source === "AI Analysis (Amazon Nova)" ? "🤖 AI Generated by Amazon Nova" : "📋 Standard Analysis"}
                            </div>
                            <p className="explanation-text">
                              {reportExplanation.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="explanation">
                      <h3>Quick Summary</h3>
                      <p>
                        {language === "hi"
                          ? translateToHindi(result.explanation)
                          : result.explanation}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>

          <HealthReminder isOpen={reminderOpen} onClose={() => setReminderOpen(false)} />
        </div>
      )}
    </>
  );
}

export default App;
