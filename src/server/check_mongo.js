const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = 'mongodb://localhost:27017/log_analyzer';

async function checkData() {
  const client = new MongoClient(uri);
  let out = '';
  try {
    await client.connect();
    const db = client.db('log_analyzer');
    const collections = await db.collections();
    
    if (collections.length === 0) {
      out += 'No collections found in log_analyzer database.\n';
    } else {
      for (const collection of collections) {
        const count = await collection.countDocuments();
        out += `Collection: ${collection.collectionName} - ${count} documents\n`;
        if (count > 0) {
          const sample = await collection.findOne({});
          out += `Sample from ${collection.collectionName}:\n${JSON.stringify(sample, null, 2)}\n\n`;
        }
      }
    }
  } catch (err) {
    out += `Error connecting to MongoDB: ${err.message}\n`;
  } finally {
    await client.close();
  }
  
  fs.writeFileSync(path.join(__dirname, 'mongo_out.txt'), out, 'utf8');
}

checkData();
