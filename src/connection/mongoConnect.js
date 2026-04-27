import mongoose from "mongoose";

async function connectMongo() {
  try {
    console.log("Starting Mongo connection...");

    const connection = await mongoose.connect(
      "mongodb://arav:280820@localhost:27017/admin"
    );

    console.log("✅ MongoDB connected");
    console.log(connection.connection.host);
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exitCode = 1;
  }
}

connectMongo();