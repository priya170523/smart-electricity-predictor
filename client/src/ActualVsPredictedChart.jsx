import React from "react";

function ActualVsPredictedChart({ records = [], prediction = null }) {
  const actualRecords = [...records]
    .filter(
      (record) =>
        record.monthKey &&
        Number.isFinite(Number(record.consumption))
    )
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-6);

  const predictedValue = Number(
    prediction?.predictedConsumption
  );

  const hasPrediction =
    prediction?.predictedConsumption !== null &&
    prediction?.predictedConsumption !== undefined &&
    Number.isFinite(predictedValue) &&
    predictedValue >= 0;

  const maxValue = Math.max(
    1,
    ...actualRecords.map((record) => Number(record.consumption)),
    ...(hasPrediction ? [predictedValue] : [])
  );

  const chartWidth = 700;
  const chartHeight = 300;
  const left = 65;
  const right = 25;
  const top = 30;
  const bottom = 65;

  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;

  const actualPoints = actualRecords.map((record, index) => {
    const x =
      actualRecords.length === 1
        ? left + plotWidth / 2
        : left + (index / (actualRecords.length - 1)) * plotWidth;

    const y =
      top +
      plotHeight -
      (Number(record.consumption) / maxValue) * plotHeight;

    return {
      x,
      y,
      month: record.monthKey,
      value: Number(record.consumption),
    };
  });

  const lastActual = actualPoints[actualPoints.length - 1];

  const predictionX = lastActual
    ? Math.min(lastActual.x + 100, chartWidth - right)
    : left + plotWidth / 2;

  const predictionY =
    top + plotHeight - (predictedValue / maxValue) * plotHeight;

  const formatValue = (value) =>
    Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });

  const formatLabel = (month) => {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return month || "Unknown";
    }

    const [year, monthNumber] = month.split("-").map(Number);

    return new Date(year, monthNumber - 1, 1).toLocaleDateString(
      "en-IN",
      {
        month: "short",
        year: "2-digit",
      }
    );
  };

  if (actualPoints.length === 0 && !hasPrediction) {
    return (
      <section className="comparison-card">
        <h2>Actual vs. Predicted Consumption</h2>
        <p>
          Add electricity readings and load a prediction to display
          the comparison graph.
        </p>
      </section>
    );
  }

  const linePoints = actualPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <section className="comparison-card">
      <div className="comparison-heading">
        <div>
          <h2>Actual vs. Predicted Consumption</h2>
          <p>
            Compare recorded electricity usage with the model's forecast.
          </p>
        </div>

        <span className="comparison-unit">Unit: kWh</span>
      </div>

      <div className="comparison-legend">
        <span>
          <i className="legend-dot actual-dot" />
          Actual consumption
        </span>

        <span>
          <i className="legend-dot predicted-dot" />
          Predicted consumption
        </span>
      </div>

      <div className="comparison-chart-wrap">
        <svg
          className="comparison-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Graph comparing actual electricity consumption and predicted consumption"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = top + plotHeight * (1 - fraction);
            const value = maxValue * fraction;

            return (
              <g key={fraction}>
                <line
                  x1={left}
                  y1={y}
                  x2={chartWidth - right}
                  y2={y}
                  stroke="#e8edf3"
                  strokeDasharray="4 4"
                />

                <text
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#718096"
                  fontSize="11"
                >
                  {formatValue(value)}
                </text>
              </g>
            );
          })}

          <line
            x1={left}
            y1={top}
            x2={left}
            y2={top + plotHeight}
            stroke="#cbd5e1"
          />

          <line
            x1={left}
            y1={top + plotHeight}
            x2={chartWidth - right}
            y2={top + plotHeight}
            stroke="#cbd5e1"
          />

          {actualPoints.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="#18a879"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {actualPoints.map((point, index) => (
            <g key={`${point.month}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#18a879"
                stroke="#ffffff"
                strokeWidth="2"
              >
                <title>
                  {formatLabel(point.month)}: {formatValue(point.value)} kWh
                </title>
              </circle>

              <text
                x={point.x}
                y={top + plotHeight + 22}
                textAnchor="middle"
                fill="#64748b"
                fontSize="11"
              >
                {formatLabel(point.month)}
              </text>
            </g>
          ))}

          {hasPrediction && (
            <g>
              {lastActual && (
                <line
                  x1={lastActual.x}
                  y1={lastActual.y}
                  x2={predictionX}
                  y2={predictionY}
                  stroke="#4385f5"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                />
              )}

              <circle
                cx={predictionX}
                cy={predictionY}
                r="7"
                fill="#4385f5"
                stroke="#ffffff"
                strokeWidth="2"
              >
                <title>
                  Forecast for {prediction?.month || "future month"}:{" "}
                  {formatValue(predictedValue)} kWh
                </title>
              </circle>

              <text
                x={predictionX}
                y={Math.max(predictionY - 14, 15)}
                textAnchor="middle"
                fill="#2563eb"
                fontSize="12"
                fontWeight="700"
              >
                {formatValue(predictedValue)}
              </text>

              <text
                x={predictionX}
                y={top + plotHeight + 42}
                textAnchor="middle"
                fill="#2563eb"
                fontSize="11"
                fontWeight="600"
              >
                Forecast
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="comparison-summary">
        <div>
          <span>Historical records</span>
          <strong>{actualRecords.length}</strong>
        </div>

        <div>
          <span>Predicted usage</span>
          <strong>
            {hasPrediction ? `${formatValue(predictedValue)} kWh` : "--"}
          </strong>
        </div>

        <div>
          <span>Forecast month</span>
          <strong>{prediction?.month || "Not available"}</strong>
        </div>
      </div>

      <p className="comparison-note">
        Note: The forecast is an estimate generated by the current
        prediction model. Actual consumption may differ. Historical
        readings and a forecast are not the same as a verified model
        accuracy measurement.
      </p>
    </section>
  );
}

export default ActualVsPredictedChart;