const cors = require("cors");
const express = require("express");

const { resolveDirectories } = require("./config/env");
const createAnalysisController = require("./controllers/analysisController");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const IncidentRepository = require("./models/IncidentRepository");
const createAnalysisRoutes = require("./routes/analysisRoutes");
const AnalysisEngine = require("./services/AnalysisEngine");
const IncidentOrchestrator = require("./services/IncidentOrchestrator");
const LogSourceResolver = require("./services/LogSourceResolver");

function createApp(cliArgs = process.argv) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (req, res) => {
    void req;
    res.status(200).json({
      name: "Incident Response API",
      endpoints: [
        "GET /api/health",
        "GET /api/report/latest",
        "POST /api/analyze"
      ]
    });
  });

  const directories = resolveDirectories();
  const repository = new IncidentRepository(directories.outputDirectory);
  const analysisEngine = new AnalysisEngine();
  const logSourceResolver = new LogSourceResolver();
  const incidentOrchestrator = new IncidentOrchestrator({
    analysisEngine,
    repository
  });

  const defaultRequest = {
    logDir: LogSourceResolver.getArgValue(cliArgs, "--log-dir="),
    logFiles: LogSourceResolver.getArgValue(cliArgs, "--log-files=")
  };
  const defaultFilePaths = logSourceResolver.resolve({
    ...defaultRequest,
    generatedLogDirectory: directories.generatedLogDirectory,
    sampleLogDirectory: directories.sampleLogDirectory
  });

  const analysisController = createAnalysisController({
    defaultFilePaths,
    defaultRequest,
    directories,
    incidentOrchestrator,
    logSourceResolver
  });

  app.use("/api", createAnalysisRoutes(analysisController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    context: {
      defaultFilePaths,
      defaultRequest,
      directories
    }
  };
}

module.exports = {
  createApp
};
