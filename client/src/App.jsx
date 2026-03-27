import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

function formatMileage(mileage) {
  return typeof mileage === "number" ? `${mileage.toLocaleString()} mi` : "Not set";
}

function DetailCard({ label, value, accent }) {
  return (
    <div className={`detail-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/maintenance`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Unable to load maintenance data.");
        }

        if (!active) {
          return;
        }

        setData(payload);
        setSelectedVehicle((current) => current || payload.vehicles[0]?.name || "");
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load maintenance data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const availableServices = useMemo(() => {
    const vehicle = data?.vehicles.find((entry) => entry.name === selectedVehicle);
    return vehicle?.serviceTypes || [];
  }, [data, selectedVehicle]);

  useEffect(() => {
    if (!availableServices.length) {
      setSelectedService("");
      return;
    }

    setSelectedService((current) => (availableServices.includes(current) ? current : availableServices[0]));
  }, [availableServices]);

  const selectedRecord = useMemo(() => {
    return data?.services.find(
      (entry) => entry.vehicle === selectedVehicle && entry.serviceType === selectedService
    );
  }, [data, selectedService, selectedVehicle]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="eyebrow">car-maintenance</div>
        <h1>Know what was done, and what comes next.</h1>
        <p>
          Connect a live Google Sheet, pick a vehicle, choose a maintenance item, and instantly see
          the last service date, mileage, and the next due target.
        </p>
      </section>

      <section className="dashboard-panel">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="vehicle-select">Vehicle</label>
            <select
              id="vehicle-select"
              value={selectedVehicle}
              onChange={(event) => setSelectedVehicle(event.target.value)}
              disabled={loading || !data?.vehicles.length}
            >
              {data?.vehicles.map((vehicle) => (
                <option key={vehicle.name} value={vehicle.name}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="service-select">Maintenance Type</label>
            <select
              id="service-select"
              value={selectedService}
              onChange={(event) => setSelectedService(event.target.value)}
              disabled={loading || !availableServices.length}
            >
              {availableServices.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <div className="status-card">Loading live maintenance data...</div> : null}
        {error ? <div className="status-card error">{error}</div> : null}

        {!loading && !error && selectedRecord ? (
          <div className="results-grid">
            <DetailCard
              label="Last Performed"
              value={selectedRecord.lastPerformed.date || "Unknown"}
            />
            <DetailCard
              label="Mileage At Service"
              value={formatMileage(selectedRecord.lastPerformed.mileage)}
            />
            <DetailCard
              label="Next Due Date"
              value={selectedRecord.nextDue.date || "Not set"}
              accent
            />
            <DetailCard
              label="Next Due Mileage"
              value={formatMileage(selectedRecord.nextDue.mileage)}
              accent
            />
          </div>
        ) : null}

        {!loading && !error && !selectedRecord ? (
          <div className="status-card">No maintenance record matched the current selection.</div>
        ) : null}

        {!loading && !error && selectedRecord ? (
          <div className="meta-panel">
            <div>
              <span>Interval</span>
              <strong>
                {selectedRecord.interval.miles
                  ? `${selectedRecord.interval.miles.toLocaleString()} miles`
                  : "Mileage interval not set"}
                {" / "}
                {selectedRecord.interval.days
                  ? `${selectedRecord.interval.days} days`
                  : "Date interval not set"}
              </strong>
            </div>
            <div>
              <span>Notes</span>
              <strong>{selectedRecord.notes || "No notes on this service entry."}</strong>
            </div>
            <div>
              <span>Sheet Refresh</span>
              <strong>{new Date(data.refreshedAt).toLocaleString()}</strong>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}


