import React from "react";

function EnergyRecommendations({ records = [] }) {
  const validRecords = records.filter(
    (record) =>
      Number.isFinite(Number(record.consumption)) &&
      Number(record.consumption) >= 0
  );

  const averageConsumption =
    validRecords.length > 0
      ? validRecords.reduce(
          (total, record) => total + Number(record.consumption),
          0
        ) / validRecords.length
      : 0;

  const targetConsumption = averageConsumption * 0.9;
  const potentialSavings = averageConsumption - targetConsumption;

  const recommendations = [
    {
      title: "Reduce standby power",
      description:
        "Switch off appliances and chargers when they are not in use.",
      icon: "🔌",
    },
    {
      title: "Use energy-efficient lighting",
      description:
        "Replace traditional bulbs with LED lights to reduce electricity consumption.",
      icon: "💡",
    },
    {
      title: "Optimize air conditioning",
      description:
        "Set your AC to a moderate temperature and clean its filters regularly.",
      icon: "❄️",
    },
    {
      title: "Run appliances efficiently",
      description:
        "Use washing machines and other high-power appliances with full loads.",
      icon: "⚡",
    },
  ];

  return (
    <section className="recommendations-section">
      <div className="recommendations-header">
        <div>
          <h2>Smart Energy-Saving Recommendations</h2>
          <p>Practical suggestions to help optimize your electricity usage.</p>
        </div>
        <span className="recommendations-badge">AI Insights</span>
      </div>

      <div className="recommendations-summary">
        <div className="recommendation-stat">
          <span className="recommendation-stat-label">
            Average Recorded Consumption
          </span>
          <strong>
            {averageConsumption.toFixed(2)} <small>kWh</small>
          </strong>
        </div>

        <div className="recommendation-stat">
          <span className="recommendation-stat-label">
            10% Reduction Target
          </span>
          <strong>
            {targetConsumption.toFixed(2)} <small>kWh</small>
          </strong>
        </div>

        <div className="recommendation-stat">
          <span className="recommendation-stat-label">
            Potential Savings
          </span>
          <strong>
            {potentialSavings.toFixed(2)} <small>kWh</small>
          </strong>
        </div>
      </div>

      {validRecords.length === 0 && (
        <p className="recommendations-empty">
          Add electricity consumption readings to calculate your average
          consumption and estimated savings.
        </p>
      )}

      <div className="recommendations-grid">
        {recommendations.map((recommendation, index) => (
          <article className="recommendation-card" key={recommendation.title}>
            <div className="recommendation-icon">{recommendation.icon}</div>
            <div>
              <span className="recommendation-number">
                Recommendation {index + 1}
              </span>
              <h3>{recommendation.title}</h3>
              <p>{recommendation.description}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="recommendations-note">
        Note: The 10% reduction target is an estimate based on your recorded
        average consumption, not a guaranteed saving or a trained AI prediction.
      </p>
    </section>
  );
}

export default EnergyRecommendations;