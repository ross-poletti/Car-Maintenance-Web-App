import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMaintenanceData } from "./sheetService.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");

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

app.use(express.static(clientDistPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(port, () => {
  console.log(`car-maintenance listening on port ${port}`);
});
