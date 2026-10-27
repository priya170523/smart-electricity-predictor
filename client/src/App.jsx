import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import ConsumptionForm from "./ConsumptionForm";
import ActualVsPredictedChart from "./ActualVsPredictedChart";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const API_URL = `${API_BASE_URL}/api/consumption`;
const PREDICTION_API_URL = `${API_BASE_URL}/api/prediction`;
const ELECTRICITY_RATE = 5;
const INITIAL_HISTORY_COUNT = 5;

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatMonth = (month) => {
  if (!month) return "Unknown";

  const match = String(month).match(/^(\d{4})-(\d{2})$/);

  if (match) {
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);

    if (monthNumber >= 1 && monthNumber <= 12) {
      return new Date(year, monthNumber - 1, 1).toLocaleDateString(
        "en-IN",
        {
          month: "long",
          year: "numeric",
        }
      );
    }
  }

  const parsed = new Date(month);

  return Number.isNaN(parsed.getTime())
    ? String(month)
    : parsed.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
};

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const getMonthKey = (record) => {
  if (record.month) {
    const month = String(record.month);

    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return month;
    }

    const parsed = new Date(month);

    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(
        parsed.getMonth() + 1
      ).padStart(2, "0")}`;
    }
  }

  if (record.createdAt) {
    const parsed = new Date(record.createdAt);

    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(
        parsed.getMonth() + 1
      ).padStart(2, "0")}`;
    }
  }

  return "";
};

const getApiMessage = async (response) => {
  try {
    const result = await response.json();
    return result.message || result.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

const extractRecords = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.records)) return result.records;
  if (Array.isArray(result?.consumptions)) return result.consumptions;

  return null;
};

// ============================================
// MAIN DASHBOARD
// ============================================

function App({ user, onLogout }) {
  const [records, setRecords] = useState([]);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [mlPrediction, setMlPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState("");
  const [predictionLoading, setPredictionLoading] = useState(true);

  const [activeSection, setActiveSection] = useState("dashboard");
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ============================================
  // FETCH CONSUMPTION RECORDS
  // ============================================

  const fetchRecords = useCallback(async () => {
    try {
      const token = localStorage.getItem("smartEnergyToken");

      if (!token) {
        throw new Error(
          "Login token not found. Please log out and log in again."
        );
      }

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please log out and log in again."
        );
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = await response.json();
      const data = extractRecords(result);

      if (!data) {
        console.error("Unexpected consumption API response:", result);
        throw new Error(
          "The API response does not contain a consumption records array."
        );
      }

      console.log("Consumption API response:", result);
      console.log("Records received from server:", data.length);

      // Replace the dashboard records only after a successful response.
      // Legacy records without a user field are retained.
      setRecords(data);
      setApiError("");
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Consumption fetch failed:", error);
      setApiError(error.message || "Unable to load consumption records.");
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  // ============================================
  // FETCH MACHINE-LEARNING PREDICTION
  // ============================================

  const fetchPrediction = useCallback(async () => {
    setPredictionLoading(true);

    try {
      const token = localStorage.getItem("smartEnergyToken");

      if (!token) {
        throw new Error("Login token not found. Please log in again.");
      }

      const response = await fetch(PREDICTION_API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please log in again."
        );
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = await response.json();

      if (result.success === false) {
        throw new Error(
          result.message || "Could not load the prediction."
        );
      }

      setMlPrediction(result);
      setPredictionError("");
    } catch (error) {
      console.error("Prediction fetch failed:", error);
      setPredictionError(
        error.message || "Unable to load the prediction."
      );
    } finally {
      setPredictionLoading(false);
    }
  }, []);

  // ============================================
  // INITIAL LOAD AND AUTOMATIC REFRESH
  // ============================================

  useEffect(() => {
    fetchRecords();
    fetchPrediction();

    const recordsInterval = setInterval(fetchRecords, 5000);

    return () => clearInterval(recordsInterval);
  }, [fetchRecords, fetchPrediction]);

  // ============================================
  // NORMALIZE AND SORT RECORDS
  // ============================================

  const monthlyRecords = useMemo(() => {
    return records
      .map((record, index) => {
        const monthKey = getMonthKey(record);

        const rawConsumption =
          record.units ??
          record.consumption ??
          record.unitsConsumed ??
          record.kwh ??
          0;

        return {
          ...record,
          monthKey,
          consumption: Number(rawConsumption),
          _displayKey:
            record._id || `${monthKey}-${index}`,
        };
      })
      .filter(
        (record) =>
          record.monthKey &&
          Number.isFinite(record.consumption) &&
          record.consumption >= 0
      )
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [records]);

  const latestRecord = monthlyRecords.length
    ? monthlyRecords[monthlyRecords.length - 1]
    : null;

  const latestConsumption = latestRecord
    ? latestRecord.consumption
    : null;

  const estimatedBill =
    latestConsumption === null
      ? null
      : latestConsumption * ELECTRICITY_RATE;

  const totalConsumption = monthlyRecords.reduce(
    (total, record) => total + record.consumption,
    0
  );

  const averageConsumption =
    monthlyRecords.length > 0
      ? totalConsumption / monthlyRecords.length
      : 0;

  const recentRecords = monthlyRecords.slice(-6);

  const maximumConsumption = Math.max(
    1,
    ...recentRecords.map((record) => record.consumption)
  );

  // ============================================
  // CONSUMPTION TREND
  // ============================================

  const trend =
    monthlyRecords.length >= 2
      ? monthlyRecords[monthlyRecords.length - 1].consumption -
        monthlyRecords[monthlyRecords.length - 2].consumption
      : null;

  const previousConsumption =
    monthlyRecords.length >= 2
      ? monthlyRecords[monthlyRecords.length - 2].consumption
      : null;

  const trendPercentage =
    previousConsumption !== null && previousConsumption !== 0
      ? (trend / previousConsumption) * 100
      : null;

  // ============================================
  // PREDICTION VALUES
  // ============================================

  const predictionMonth = mlPrediction?.month || "Not available";

  const predictedConsumption =
    mlPrediction?.predictedConsumption != null
      ? Number(mlPrediction.predictedConsumption)
      : null;

  const predictedBill =
    mlPrediction?.estimatedBill != null
      ? Number(mlPrediction.estimatedBill)
      : predictedConsumption !== null
        ? predictedConsumption *
          Number(mlPrediction?.electricityRate ?? ELECTRICITY_RATE)
        : null;

  const predictionModel = mlPrediction?.model || "ML model";

  // ============================================
  // ENERGY-SAVING RECOMMENDATIONS
  // ============================================

  const recommendations = useMemo(() => {
    if (!latestRecord) {
      return [
        {
          icon: "📊",
          title: "Record your consumption",
          description:
            "Add monthly meter readings to receive recommendations based on your household usage.",
        },
        {
          icon: "💡",
          title: "Switch off unused lights",
          description:
            "Turn off lights and electrical devices when they are not needed.",
        },
        {
          icon: "🌡️",
          title: "Use air conditioning efficiently",
          description:
            "Choose a moderate temperature and keep doors and windows closed while cooling.",
        },
      ];
    }

    const tips = [];

    if (Number(latestRecord.airConditioners || 0) > 0) {
      tips.push({
        icon: "❄️",
        title: "Optimize air conditioning",
        description:
          "Use a moderate temperature, clean filters regularly, and close doors and windows while cooling.",
      });
    }

    if (Number(latestRecord.fans || 0) > 0) {
      tips.push({
        icon: "🌀",
        title: "Use fans efficiently",
        description:
          "Switch off fans in unoccupied rooms and clean fan blades regularly.",
      });
    }

    if (Number(latestRecord.refrigerators || 0) > 0) {
      tips.push({
        icon: "🧊",
        title: "Improve refrigerator efficiency",
        description:
          "Keep refrigerator doors closed, allow ventilation around the appliance, and check door seals.",
      });
    }

    tips.push({
      icon: "💡",
      title: "Reduce standby usage",
      description:
        "Switch off unused electronics and consider energy-efficient LED lighting.",
    });

    if (monthlyRecords.length >= 2 && trend !== null && trend > 0) {
      tips.push({
        icon: "📈",
        title: "Review your rising consumption",
        description: `Your latest recorded consumption increased by ${formatNumber(
          trend
        )} kWh compared with the previous month. Review appliance usage and operating hours.`,
      });
    }

    return tips.slice(0, 4);
  }, [latestRecord, monthlyRecords.length, trend]);

  // ============================================
  // NAVIGATION
  // ============================================

  const navigateTo = (section) => {
    setActiveSection(section);

    const element = document.getElementById(section);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // ============================================
  // CONSUMPTION HISTORY
  // ============================================

  const displayedHistory = useMemo(() => {
    const newestFirst = [...monthlyRecords].reverse();

    return showAllHistory
      ? newestFirst
      : newestFirst.slice(0, INITIAL_HISTORY_COUNT);
  }, [monthlyRecords, showAllHistory]);

  // ============================================
  // RENDER DASHBOARD
  // ============================================

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          ⚡ Smart<span>Energy</span>
        </div>

        <p className="menu-label">MAIN MENU</p>

        <nav>
          <button
            className={activeSection === "dashboard" ? "active" : ""}
            onClick={() => navigateTo("dashboard")}
          >
            🏠 Dashboard
          </button>

          <button
            className={activeSection === "consumption" ? "active" : ""}
            onClick={() => navigateTo("consumption")}
          >
            📊 Consumption
          </button>

          <button
            className={activeSection === "prediction" ? "active" : ""}
            onClick={() => navigateTo("prediction")}
          >
            🔮 Prediction
          </button>

          <button
            className={activeSection === "energy-saving" ? "active" : ""}
            onClick={() => navigateTo("energy-saving")}
          >
            🌱 Energy Saving
          </button>

          <button
            className={activeSection === "add-reading" ? "active" : ""}
            onClick={() => navigateTo("add-reading")}
          >
            ➕ Add Readings
          </button>
        </nav>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          API connection
          <strong>{apiError ? "Check connection" : "Active"}</strong>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="top-header">
          <div>
            <h1>Smart Electricity Dashboard</h1>
            <p>
              Monitor your home's electricity consumption and usage trends.
            </p>
          </div>

          <div className="user-profile">
            <div className="profile-icon">⚡</div>

            <div>
              <strong>{user?.name || "My Home"}</strong>
              <p>{user?.email || "Energy Dashboard"}</p>
            </div>

            <button type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="welcome-banner">
          <div>
            <h2>
              Welcome{user?.name ? `, ${user.name}` : ""} to SmartEnergy! 🌿
            </h2>

            <p>
              Track your electricity meter readings, understand your
              consumption, and explore estimates for future energy usage.
            </p>
          </div>

          <div className="welcome-illustration">🏡</div>
        </section>

        {apiError && (
          <div className="error-message">
            <strong>Consumption API issue:</strong> {apiError}
            <button type="button" onClick={fetchRecords}>
              Retry
            </button>
          </div>
        )}

        {recordsLoading && (
          <p className="loading-message">
            Loading your electricity consumption records...
          </p>
        )}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon">⚡</div>
            <p>Latest Consumption</p>

            <h2>
              {latestConsumption === null
                ? "--"
                : `${formatNumber(latestConsumption)} kWh`}
            </h2>

            <span>
              {latestRecord
                ? formatMonth(latestRecord.monthKey)
                : "No consumption records available"}
            </span>
          </article>

          <article className="stat-card">
            <div className="stat-icon">🔮</div>
            <p>ML Predicted Consumption</p>

            <h2>
              {predictionLoading
                ? "Loading..."
                : predictedConsumption === null
                  ? "--"
                  : `${formatNumber(predictedConsumption)} kWh`}
            </h2>

            <span>
              {predictionError
                ? "Prediction unavailable"
                : `Prediction for ${predictionMonth}`}
            </span>
          </article>

          <article className="stat-card">
            <div className="stat-icon">💰</div>
            <p>Estimated Electricity Bill</p>

            <h2>
              {estimatedBill === null
                ? "--"
                : `₹${formatNumber(estimatedBill)}`}
            </h2>

            <span>
              Illustrative rate: ₹{ELECTRICITY_RATE} per unit
            </span>
          </article>

          <article className="stat-card">
            <div className="stat-icon">📈</div>
            <p>Usage Trend</p>

            <h2>
              {trend === null
                ? "Not enough data"
                : `${trend > 0 ? "+" : ""}${formatNumber(trend)} kWh`}
            </h2>

            <span>
              {trendPercentage === null
                ? "Requires at least 2 months of data"
                : `${trendPercentage > 0 ? "+" : ""}${formatNumber(
                    trendPercentage
                  )}% compared with previous month`}
            </span>
          </article>
        </section>

        {/* ======================================
            CONSUMPTION CHART
        ====================================== */}

        <section className="content-grid">
          <article className="chart-card" id="consumption">
            <h2>Monthly Electricity Consumption</h2>
            <p>Your saved consumption records, measured in kWh.</p>

            {recentRecords.length === 0 ? (
              <div className="empty-state">
                <div>📊</div>
                <h3>
                  {recordsLoading
                    ? "Loading consumption records..."
                    : "No consumption records found"}
                </h3>

                <p>
                  {apiError
                    ? "Check the API connection and retry."
                    : "Your saved monthly records will appear here."}
                </p>

                <button type="button" onClick={fetchRecords}>
                  Refresh records
                </button>
              </div>
            ) : (
              <div className="chart">
                <div className="chart-bars">
                  {recentRecords.map((record) => {
                    const barHeight =
                      (record.consumption / maximumConsumption) * 100;

                    return (
                      <div
                        className="chart-column"
                        key={record._displayKey}
                        title={`${formatMonth(
                          record.monthKey
                        )}: ${formatNumber(record.consumption)} kWh`}
                      >
                        <strong className="bar-value">
                          {formatNumber(record.consumption)}
                        </strong>

                        <div className="bar-track">
                          <div
                            className="chart-bar"
                            style={{
                              height: `${Math.max(barHeight, 2)}%`,
                            }}
                          />
                        </div>

                        <span>{record.monthKey.slice(5)}</span>
                        <small>{record.monthKey.slice(0, 4)}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {monthlyRecords.length > 0 && (
              <div className="chart-summary">
                <span>
                  Total recorded:{" "}
                  <strong>{formatNumber(totalConsumption)} kWh</strong>
                </span>

                <span>
                  Monthly average:{" "}
                  <strong>{formatNumber(averageConsumption)} kWh</strong>
                </span>
              </div>
            )}
          </article>

          {/* ======================================
              AI PREDICTION
          ====================================== */}

          <article className="forecast-card" id="prediction">
            <h2>AI Consumption Forecast</h2>
            <p>Predicted consumption for {predictionMonth}</p>

            {predictionLoading ? (
              <div className="forecast-value">Loading...</div>
            ) : predictionError ? (
              <div className="error-message">
                {predictionError}
                <button type="button" onClick={fetchPrediction}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="forecast-value">
                  {predictedConsumption === null
                    ? "--"
                    : formatNumber(predictedConsumption)}
                  <span> kWh</span>
                </div>

                <div className="forecast-details">
                  <div className="forecast-row">
                    <span>Prediction model</span>
                    <strong>{predictionModel}</strong>
                  </div>

                  <div className="forecast-row">
                    <span>Estimated bill</span>
                    <strong>
                      {predictedBill === null
                        ? "--"
                        : `₹${formatNumber(predictedBill)}`}
                    </strong>
                  </div>

                  <div className="forecast-row">
                    <span>Rate per unit</span>
                    <strong>
                      ₹
                      {formatNumber(
                        mlPrediction?.electricityRate ?? ELECTRICITY_RATE
                      )}
                    </strong>
                  </div>
                </div>

                <p className="forecast-note">
                  ⚠️ Experimental forecast. Accuracy may be limited by the
                  amount of historical data available.
                </p>
              </>
            )}

            <button
              type="button"
              className="refresh-button"
              onClick={fetchPrediction}
              disabled={predictionLoading}
            >
              {predictionLoading
                ? "Refreshing..."
                : "Refresh prediction"}
            </button>
          </article>
        </section>

        {/* ======================================
            ACTUAL VS PREDICTED CHART
        ====================================== */}

        <section className="comparison-section">
          <ActualVsPredictedChart
            records={monthlyRecords}
            prediction={mlPrediction}
          />
        </section>

        {/* ======================================
            MONTHLY CONSUMPTION HISTORY
        ====================================== */}

        <section className="history-card" id="history">
          <div className="section-heading">
            <div>
              <h2>Monthly Consumption History</h2>
              <p>Review your recorded meter readings.</p>
            </div>

            <span className="record-count">
              {monthlyRecords.length} record(s)
            </span>
          </div>

          {monthlyRecords.length === 0 ? (
            <div className="empty-history">
              {recordsLoading
                ? "Loading records..."
                : "No records found. Check the API connection or add a reading."}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Previous Reading</th>
                      <th>Current Reading</th>
                      <th>Consumption</th>
                      <th>Estimated Bill</th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayedHistory.map((record) => (
                      <tr key={record._displayKey}>
                        <td>{formatMonth(record.monthKey)}</td>

                        <td>
                          {record.previousReading == null
                            ? "--"
                            : formatNumber(record.previousReading)}
                        </td>

                        <td>
                          {record.currentReading == null
                            ? "--"
                            : formatNumber(record.currentReading)}
                        </td>

                        <td>
                          <strong>
                            {formatNumber(record.consumption)} kWh
                          </strong>
                        </td>

                        <td>
                          ₹
                          {formatNumber(
                            record.consumption * ELECTRICITY_RATE
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {monthlyRecords.length > INITIAL_HISTORY_COUNT && (
                <div className="history-actions">
                  <p>
                    Showing {displayedHistory.length} of{" "}
                    {monthlyRecords.length} records
                  </p>

                  <button
                    type="button"
                    className="history-toggle-button"
                    onClick={() =>
                      setShowAllHistory((previous) => !previous)
                    }
                  >
                    {showAllHistory
                      ? "Show Less ↑"
                      : "Show All Records ↓"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ======================================
            ADD ELECTRICITY READING
        ====================================== */}

        <section className="form-card" id="add-reading">
          <h2>Add Electricity Reading</h2>

          <p>
            Enter your monthly meter readings and household appliance details.
          </p>

          <ConsumptionForm />
        </section>

        {/* ======================================
            ENERGY-SAVING RECOMMENDATIONS
        ====================================== */}

        <section className="recommendations-section" id="energy-saving">
          <div className="section-heading">
            <div>
              <h2>Smart Energy-Saving Recommendations</h2>

              <p>
                Practical suggestions based on your recorded household
                appliance information and consumption trend.
              </p>
            </div>
          </div>

          <div className="recommendations-grid">
            {recommendations.map((recommendation, index) => (
              <article
                className="recommendation-card"
                key={`${recommendation.title}-${index}`}
              >
                <div className="recommendation-icon">
                  {recommendation.icon}
                </div>

                <h3>{recommendation.title}</h3>
                <p>{recommendation.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ======================================
            FOOTER
        ====================================== */}

        <footer className="footer">
          <p>
            SmartEnergy · AI-Based Smart Electricity Consumption Predictor
            and Energy Optimization System
          </p>

          <span>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString("en-IN")}`
              : "Waiting for data..."}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;