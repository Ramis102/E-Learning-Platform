import { Router } from "express";
import {
  generateCertificate,
  getMyCertificates,
  downloadCertificate,
  verifyCertificate,
} from "../controllers/certificateController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { UserRole } from "../models/User";

const router = Router();

// Public route — anyone can verify a certificate
router.get("/verify/:uuid", verifyCertificate);

// Protected routes — students only
router.get("/my", protect, authorizeRoles(UserRole.STUDENT), getMyCertificates);
router.post("/:courseId/generate", protect, authorizeRoles(UserRole.STUDENT), generateCertificate);
router.get("/:courseId/download", protect, authorizeRoles(UserRole.STUDENT), downloadCertificate);

export default router;
