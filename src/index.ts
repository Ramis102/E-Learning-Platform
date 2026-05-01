import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";

// ── Load environment variables before anything else ────────────────────────
dotenv.config();

import connectDB from "./config/db";
import swaggerSpec from "./config/swagger";
import authRoutes from "./routes/authRoutes";
import profileRoutes from "./routes/profileRoutes";
import courseRoutes from "./routes/courseRoutes";
import questionRoutes from "./routes/questionRoutes";
import quizAttemptRoutes from "./routes/quizAttemptRoutes";
import blogRoutes from "./routes/blogRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import certificateRoutes from "./routes/certificateRoutes";
import adminRoutes from "./routes/adminRoutes";

// ---------------------------------------------------------------------------
// App Initialization
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" })); // JSON body parser
app.use(express.urlencoded({ extended: true })); // URL-encoded body parser

// ---------------------------------------------------------------------------
// Rate Limiting (auth routes)
// ---------------------------------------------------------------------------

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per window
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/attempts", quizAttemptRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/admin", adminRoutes);

// ---------------------------------------------------------------------------
// Swagger Documentation
// ---------------------------------------------------------------------------

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "E-Learning Platform API Docs",
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

// Expose raw spec as JSON
app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "E-Learning Platform API is running",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler (B7 fix)
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error",
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const startServer = async (): Promise<void> => {
  // Connect to MongoDB first
  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📚 API Docs:  http://localhost:${PORT}/api-docs`);
    console.log(`❤️  Health:    http://localhost:${PORT}/api/health\n`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export default app;
