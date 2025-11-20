require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend

// ---------------------------------------------------------
// 💾 PERSISTENT FILE DATABASE
// ---------------------------------------------------------
// Load data from file or create if missing
function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { clients: [], logs: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------
// 🔗 ENDPOINT 1: RETELL CUSTOM FUNCTION (Booking Router)
// ---------------------------------------------------------
app.post('/retell-booking', async (req, res) => {
  console.log("📥 Incoming Booking Request:", JSON.stringify(req.body, null, 2));

  try {
    // 1. Robust Agent ID Check (URL -> Header -> Body)
    // We check this first so we know WHO is calling
    const agent_id = req.query.agent_id || 
                     req.headers['x-agent-id'] || 
                     req.body.agent_id || 
                     req.body.call?.agent_id;

    if (!agent_id) {
      console.error("❌ Error: No Agent ID found.");
      return res.status(400).json({ message: "System Error: Agent ID missing." });
    }
    
    // 2. Load Database and Find Client
    const db = loadDatabase();
    const client = db.clients.find(c => c.retell_agent_id === agent_id);
    
    if (!client) {
      console.error(`❌ No client found for Agent ID: ${agent_id}`);
      return res.json({ 
        message: "I apologize, but I cannot access the calendar configuration for this line." 
      });
    }

    // 3. INTELLIGENT ARGS EXTRACTION (The Fix 🔧)
    // Sometimes Retell sends { args: {name...} }, sometimes just { name... }
    let bookingData = req.body.args || req.body;

    // If 'args' was missing, bookingData might still be the wrapper (containing 'call', etc.)
    // So we sanitize it by ensuring we have the fields we need.
    if (!bookingData || (!bookingData.name && !bookingData.email && !bookingData.time_slot)) {
         console.error("❌ Could not find booking arguments in body.");
         throw new Error("No valid booking arguments (name/time) received.");
    }

    const { name, email, phone, address, time_slot } = bookingData; 

    console.log(`📅 Booking for ${client.name}: ${name}, ${time_slot}`);
    
    // 4. Prepare Notes and Call Cal.com
    const meetingNotes = `Phone: ${phone}\nAddress: ${address}\nBooked by AI Receptionist`;

    await axios.post(`https://api.cal.com/v1/bookings?apiKey=${client.cal_api_key}`, {
      eventTypeId: parseInt(client.cal_event_type_id),
      start: time_slot,
      // ADDED: Required 'timeZone' (Defaulting to UTC/London for safety)
      timeZone: 'Europe/London', 
      // ADDED: Required 'language'
      language: 'en',          
      
      responses: {
        name: name || "Valued Caller",
        email: email || "phone@booking.com",
        phone: phone,
        address: address,
        notes: meetingNotes 
      },
      
      // REMOVED 'location' object entirely to fix "received object" error.
      // We rely on the Cal.com Event Type setting and the notes above.
      
      description: meetingNotes,
      metadata: { source: "Retell AI Receptionist" }
    });

    return res.json({
      message: `Success. I have booked the appointment for ${name} at that time.`
    });

  } catch (error) {
    const detailedError = error.response?.data?.message || error.message;
    console.error("💥 Booking Error:", detailedError);
    
    return res.json({
      message: `System Error: ${detailedError}` 
    });
  }
});

// ---------------------------------------------------------
// 🔗 ENDPOINT 2: RETELL WEBHOOK (Call Logger)
// ---------------------------------------------------------
app.post('/retell-webhook', (req, res) => {
  const { event, call } = req.body;

  if (event === 'call_ended') {
    const db = loadDatabase();
    const client = db.clients.find(c => c.retell_agent_id === call.agent_id);
    
    const logEntry = {
      call_id: call.call_id,
      client_name: client ? client.name : "Unknown Client",
      agent_id: call.agent_id,
      transcript: call.transcript,
      status: call.disconnection_reason,
      timestamp: new Date().toISOString()
    };

    // Add to logs and save
    db.logs.unshift(logEntry);
    if (db.logs.length > 50) db.logs.pop(); // Keep only last 50 logs
    saveDatabase(db);
    
    console.log("📝 Log saved for:", logEntry.client_name);
  }

  res.sendStatus(200);
});

// ---------------------------------------------------------
// 🖥️ DASHBOARD API
// ---------------------------------------------------------
app.get('/api/clients', (req, res) => {
    const db = loadDatabase();
    res.json(db.clients);
});

app.post('/api/clients', (req, res) => {
    const db = loadDatabase();
    const newClient = { id: Date.now(), ...req.body };
    db.clients.push(newClient);
    saveDatabase(db);
    res.json({ success: true, client: newClient });
});

app.get('/api/logs', (req, res) => {
    const db = loadDatabase();
    res.json(db.logs);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});