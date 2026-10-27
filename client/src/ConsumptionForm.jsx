import { useState } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

function ConsumptionForm() {
  const [form, setForm] = useState({
    month: "",
    previousReading: "",
    currentReading: "",
    familyMembers: "1",
    fans: "0",
    airConditioners: "0",
    refrigerators: "0",
    otherAppliances: "0",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const electricityRate = 5;

  const previous = Number(form.previousReading);
  const current = Number(form.currentReading);

  const readingsEntered =
    form.previousReading.trim() !== "" &&
    form.currentReading.trim() !== "";

  const validReadings =
    readingsEntered &&
    Number.isFinite(previous) &&
    Number.isFinite(current) &&
    previous >= 0 &&
    current >= previous;

  const unitsConsumed = validReadings ? current - previous : null;

  const estimatedBill =
    unitsConsumed !== null ? unitsConsumed * electricityRate : null;

  function handleChange(event) {
    const { name, value } = event.target;

    setForm(function (previousForm) {
      return {
        ...previousForm,
        [name]: value,
      };
    });

    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    // Validate month selection.
    const selectedMonth = String(form.month || "").trim();
    const monthParts = selectedMonth.split("-");

    if (
      monthParts.length !== 2 ||
      !/^\d{4}$/.test(monthParts[0]) ||
      !/^\d{1,2}$/.test(monthParts[1]) ||
      Number(monthParts[1]) < 1 ||
      Number(monthParts[1]) > 12
    ) {
      setError("Please select a valid month using the Month field.");
      return;
    }

    // Normalize the month to YYYY-MM.
    const normalizedMonth =
      monthParts[0] + "-" + monthParts[1].padStart(2, "0");

    // Validate meter readings.
    if (
      form.previousReading.trim() === "" ||
      form.currentReading.trim() === "" ||
      !Number.isFinite(previous) ||
      !Number.isFinite(current) ||
      previous < 0 ||
      current < previous
    ) {
      setError(
        "Enter valid meter readings. The current reading must be greater than or equal to the previous reading."
      );
      return;
    }

    const units = current - previous;

    if (units <= 0) {
      setError(
        "Electricity consumption must be greater than zero to save a record."
      );
      return;
    }

    // Validate household and appliance counts.
    const numberFields = [
      {
        name: "familyMembers",
        label: "Family members",
        minimum: 1,
      },
      {
        name: "fans",
        label: "Number of fans",
        minimum: 0,
      },
      {
        name: "airConditioners",
        label: "Air conditioners",
        minimum: 0,
      },
      {
        name: "refrigerators",
        label: "Refrigerators",
        minimum: 0,
      },
      {
        name: "otherAppliances",
        label: "Other appliances",
        minimum: 0,
      },
    ];

    for (const field of numberFields) {
      const value = form[field.name].trim();
      const number = Number(value);

      if (
        value === "" ||
        !Number.isInteger(number) ||
        number < field.minimum
      ) {
        setError(
          field.label +
            " must be a whole number of at least " +
            field.minimum +
            "."
        );
        return;
      }
    }

    const payload = {
      month: normalizedMonth,
      units: units,
      previousReading: previous,
      currentReading: current,
      familyMembers: Number(form.familyMembers),
      fans: Number(form.fans),
      airConditioners: Number(form.airConditioners),
      refrigerators: Number(form.refrigerators),
      otherAppliances: Number(form.otherAppliances),
    };

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/consumption`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const responseText = await response.text();

      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          "The server returned an unexpected response. Check your backend."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to save consumption. Server status: " +
              response.status
        );
      }

      setMessage(
        data.message || "Consumption saved successfully."
      );

      // Clear readings and appliance counts after saving.
      // Keep the selected month.
      setForm(function (previousForm) {
        return {
          ...previousForm,
          previousReading: "",
          currentReading: "",
          familyMembers: "1",
          fans: "0",
          airConditioners: "0",
          refrigerators: "0",
          otherAppliances: "0",
        };
      });
    } catch (err) {
      console.error("Error saving electricity consumption:", err);

      setError(
        err.message ||
          "Unable to connect to the server. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="consumption-section">
      <h2>Record Electricity Consumption</h2>

      <p>
        Enter your actual electricity meter readings to calculate
        household consumption.
      </p>

      <form className="consumption-form" onSubmit={handleSubmit}>
        <label>
          Month
          <input
            type="month"
            name="month"
            value={form.month}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Previous meter reading (kWh)
          <input
            type="number"
            name="previousReading"
            min="0"
            step="any"
            value={form.previousReading}
            onChange={handleChange}
            placeholder="Enter previous reading"
            required
          />
        </label>

        <label>
          Current meter reading (kWh)
          <input
            type="number"
            name="currentReading"
            min="0"
            step="any"
            value={form.currentReading}
            onChange={handleChange}
            placeholder="Enter current reading"
            required
          />
        </label>

        {unitsConsumed !== null && (
          <div className="consumption-summary">
            <p>
              <strong>Calculated consumption: </strong>
              {unitsConsumed.toLocaleString("en-IN")} kWh
            </p>

            <p>
              <strong>Estimated bill: </strong>
              {estimatedBill.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
              })}
            </p>

            <small>
              Illustrative calculation at ₹5 per unit; your actual bill may differ.
            </small>
          </div>
        )}

        <label>
          Family members
          <input
            type="number"
            name="familyMembers"
            min="1"
            step="1"
            value={form.familyMembers}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Number of fans
          <input
            type="number"
            name="fans"
            min="0"
            step="1"
            value={form.fans}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Air conditioners
          <input
            type="number"
            name="airConditioners"
            min="0"
            step="1"
            value={form.airConditioners}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Refrigerators
          <input
            type="number"
            name="refrigerators"
            min="0"
            step="1"
            value={form.refrigerators}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Other appliances
          <input
            type="number"
            name="otherAppliances"
            min="0"
            step="1"
            value={form.otherAppliances}
            onChange={handleChange}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Calculate & Save Consumption"}
        </button>

        {message && (
          <p className="success-message">{message}</p>
        )}

        {error && (
          <p className="error-message">{error}</p>
        )}
      </form>
    </section>
  );
}

export default ConsumptionForm;
