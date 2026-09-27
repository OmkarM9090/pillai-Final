const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data); // If not JSON
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log("Testing /api/v1/forecast/weekly...");
  const forecast = await testEndpoint('/api/v1/forecast/weekly');
  console.log(JSON.stringify(forecast).substring(0, 200) + '...');
  
  console.log("\nTesting /api/v1/dashboard...");
  // the dashboard endpoint requires auth, but wait, does it? Let's see if we get a 401.
  const dashboard = await testEndpoint('/api/v1/dashboard');
  if (dashboard.error && dashboard.error.includes("jwt")) {
      console.log("Dashboard requires auth, testing skipped for this script.");
  } else {
      console.log(JSON.stringify(dashboard).substring(0, 200) + '...');
  }
}

run().catch(console.error);
