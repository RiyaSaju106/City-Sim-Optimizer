// server.js — lightweight backend with live traffic
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static files (your index.html, CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// ---------------------
// API endpoint: optimize city metrics
// ---------------------
app.post('/optimize', (req, res) => {
  const { traffic, waste, water } = req.body;
  const suggestions = [];

  if (traffic > 2.0) suggestions.push("🚦 Too much traffic → Optimize signal timings or reroute vehicles.");
  if (waste > 70) suggestions.push("🗑️ High waste levels → Send more trucks for collection.");
  if (water > 60) suggestions.push("💧 Water shortage risk → Reduce non-essential usage.");
  if (suggestions.length === 0) suggestions.push("✅ City is stable. No immediate action needed.");

  res.json({ suggestions });
});

// ---------------------
// API endpoint: report an issue
// ---------------------
const issues = []; // temporary in-memory storage

app.post('/reportIssue', (req, res) => {
  const { type, desc, lat, lng } = req.body;
  if (!type || !desc) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const issue = {
    id: issues.length + 1,
    type,
    desc,
    lat,
    lng,
    time: new Date()
  };
  issues.push(issue);
  res.json(issue);
});

// ---------------------
// API endpoint: live traffic
// ---------------------
const TRAFFIC_API_URL = 'https://api.trafficprovider.com/live'; // replace with real API
const API_KEY = '3K9kSnXBJGDJ0VzpJr82wjoZR5oLKNpW'; // secret key — keep only on server

app.get('/getTraffic', async (req, res) => {
  try {
    const response = await fetch(TRAFFIC_API_URL, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const data = await response.json();
    
    // Optional: Map or filter data to only include your road segments
    res.json(data);
  } catch (err) {
    console.error('Traffic fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch traffic' });
  }
});

// ---------------------
// NEW ROUTE: Traffic Heatmap points
// ---------------------
app.get('/getTrafficHeatmap', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

    const centerLat = parseFloat(lat);
    const centerLon = parseFloat(lon);
    const delta = 0.0015; // ~150m grid spacing
    const points = [];
    const steps = [-delta, 0, delta];

    for (let dlat of steps) {
      for (let dlon of steps) {
        const pLat = centerLat + dlat;
        const pLon = centerLon + dlon;
        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${pLat},${pLon}&key=${API_KEY}`;

        try {
          const response = await fetch(url);
          const data = await response.json();
          let intensity = 0.5; // default
          if (data.flowSegmentData) {
            const free = data.flowSegmentData.freeFlowSpeed || 50;
            const current = data.flowSegmentData.currentSpeed || free;
            intensity = Math.min(Math.max(free / current, 0.5), 3.0);
          }
          points.push({ lat: pLat, lon: pLon, intensity });
        } catch (e) {
          console.error('Failed to fetch point:', pLat, pLon, e);
        }
      }
    }

    res.json({ points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch heatmap points' });
  }
});

// ---------------------
// Start the server
// ---------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

