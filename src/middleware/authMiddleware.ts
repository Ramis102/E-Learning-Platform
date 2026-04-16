import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUserDocument, UserRole } from "../models/User";

// ---------------------------------------------------------------------------
// Extended Request type for authenticated routes
// ---------------------------------------------------------------------------

export interface AuthRequest extends Request {
  user?: IUserDocument;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// protect — Verify JWT & attach user to request
// ---------------------------------------------------------------------------

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // ── Extract Bearer token from Authorization header ─────────────
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Not authorized — no token provided",
      });
      return;
    }

    // ── Verify token ──────────────────────────────────────────────
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    // ── Fetch user from DB and attach to request ──────────────────
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized — user no longer exists",
      });
      return;
    }

    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Not authorized — invalid token",
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Not authorized — token has expired",
      });
      return;
    }

    console.error("Auth Middleware Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
    });
  }
};

// ---------------------------------------------------------------------------
// authorizeRoles — Role-based access control
// ---------------------------------------------------------------------------

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized — user not found in request",
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden — role '${user.role}' is not authorized to access this resource`,
      });
      return;
    }

    next();
  };
};
