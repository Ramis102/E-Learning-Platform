import dns from "dns";
import mongoose from "mongoose";
import User from "../models/User";

type ConnectOptions = {
  autoSeedAtlas?: boolean;
};

const getMongoUri = (): { uri: string; source: "atlas" | "local" | "default" } => {
  const source = (process.env.MONGO_SOURCE || "default").trim().toLowerCase();

  if (source === "atlas") {
    const atlasUri = process.env.MONGO_URI_ATLAS;
    if (!atlasUri) {
      throw new Error(
        "MONGO_SOURCE is set to atlas, but MONGO_URI_ATLAS is not defined"
      );
    }
    return { uri: atlasUri, source: "atlas" };
  }

  if (source === "local") {
    const localUri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;
    if (!localUri) {
      throw new Error("MONGO_URI_LOCAL is not defined in environment variables");
    }
    return { uri: localUri, source: "local" };
  }

  if (source !== "default") {
    throw new Error(
      `Invalid MONGO_SOURCE "${process.env.MONGO_SOURCE}". Use "atlas" or "local"`
    );
  }

  const fallbackUri = process.env.MONGO_URI;
  if (!fallbackUri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  return { uri: fallbackUri, source: "default" };
};

const applyDnsOverride = (): void => {
  const dnsServers = process.env.DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (dnsServers?.length) {
    dns.setServers(dnsServers);
    console.log(`Using custom DNS servers for MongoDB: ${dnsServers.join(", ")}`);
  }
};

const connectDB = async (options: ConnectOptions = {}): Promise<void> => {
  try {
    const { autoSeedAtlas = true } = options;
    const { uri, source } = getMongoUri();
    applyDnsOverride();
    const conn = await mongoose.connect(uri);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    if (source === "atlas" && autoSeedAtlas) {
      const userCount = await User.estimatedDocumentCount();
      if (userCount === 0) {
        console.log("Atlas database empty - running seed...");
        const seedModule = await import("../seed");
        await seedModule.runSeed({
          skipConnect: true,
          shouldDisconnect: false,
          shouldExit: false,
        });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`MongoDB Connection Error: ${error.message}`);
    } else {
      console.error("MongoDB Connection Error: Unknown error");
    }
    process.exit(1);
  }
};

export default connectDB;
