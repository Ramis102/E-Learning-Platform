import jwt, { Secret, SignOptions } from "jsonwebtoken";

/**
 * Generate a signed JWT for the given user ID.
 */
export const generateToken = (userId: string): string => {
  const secret: Secret = process.env.JWT_SECRET as string;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  // Default: 7 days in seconds
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  const options: SignOptions = {
    expiresIn: expiresIn as unknown as SignOptions["expiresIn"],
  };

  return jwt.sign({ id: userId }, secret, options);
};

