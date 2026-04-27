const mongoose = require('mongoose');
const createAuthController = require('./src/controllers/authController');

async function test() {
  await mongoose.connect('mongodb://arav:280820@localhost:27017/log_analyzer?authSource=admin');
  const UserModel = require('./src/models/User');
  const userModel = new UserModel(mongoose.connection.db);
  
  const authController = createAuthController({ userModel });

  // Get a user ID to test
  const user = await mongoose.connection.db.collection('users').findOne({});
  if (!user) {
    console.log("No user found in DB.");
    process.exit(0);
  }

  console.log("Found User:", user.email);

  const req = {
    user: { id: user._id.toString() }
  };

  const res = {
    json: (data) => console.log("RES.JSON called with:", data),
    status: (code) => ({
      json: (data) => console.log(`RES.STATUS(${code}).JSON called with:`, data)
    })
  };

  const next = (err) => console.error("NEXT called with error:", err);

  await authController.sendTestEmail(req, res, next);
  process.exit(0);
}

test().catch(console.error);
