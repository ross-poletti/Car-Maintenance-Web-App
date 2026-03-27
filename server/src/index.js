import cors from "cors";
import express from "express";
import { getMaintenanceData } from "./sheetService.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/maintenance", async (_req, res) => {
  try {
    const data = await getMaintenanceData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Unknown error loading maintenance data."
    });
  }
});

app.listen(port, () => {
  console.log(`Maintenance API listening on port ${port}`);
});
