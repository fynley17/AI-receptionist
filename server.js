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
// 🔗 ENDPOINT 1: RETELL CUSTOM FUNCTION (Booking Router - SINGLE EVENT)
// ---------------------------------------------------------
app.post('/retell-booking', async (req, res) => {
    console.log("📥 Incoming Booking Request:", JSON.stringify(req.body, null, 2));

    try {
        // 1. Robust Agent ID Check (URL -> Header -> Body)
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
        // Now we DON'T need event_name here
        let bookingData = req.body.args || req.body;

        if (!bookingData || (!bookingData.name && !bookingData.email && !bookingData.time_slot)) {
            console.error("❌ Could not find booking arguments in body.");
            throw new Error("No valid booking arguments (name/time) received.");
        }

        const { name, email, phone, address, time_slot } = bookingData; 
        
        // Use the single event ID directly from the client configuration
        const eventTypeId = parseInt(client.cal_event_type_id);

        console.log(`📅 Booking for ${client.name} (Event ID ${eventTypeId}): ${name}, ${time_slot}`);
        
        // 4. Prepare Notes and Call Cal.com
        const meetingNotes = `Phone: ${phone}\nAddress: ${address}\nBooked by AI Receptionist`;

        await axios.post(`https://api.cal.com/v1/bookings?apiKey=${client.cal_api_key}`, {
            eventTypeId: eventTypeId, // Using the single, stored ID
            start: time_slot,
            timeZone: 'Europe/London', 
            language: 'en',          
            
            responses: {
                name: name || "Valued Caller",
                email: email || "phone@booking.com",
                phone: phone,
                address: address,
                notes: meetingNotes 
            },
            
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
            // Ensure you return the exact Cal.com error message for debugging
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

// server.js (Add these two routes)

// ---------------------------------------------------------
// 🔄 UPDATE: Clients (PUT /api/clients/:id)
// ---------------------------------------------------------
app.put('/api/clients/:id', (req, res) => {
    // Ensure the ID parameter is parsed as an integer
    const clientId = parseInt(req.params.id);
    const db = loadDatabase();
    // Find the index of the client to update
    const index = db.clients.findIndex(c => c.id === clientId);

    if (index !== -1) {
        // Merge existing data with new data from the body
        // Ensure ID remains constant (parsed from URL param)
        db.clients[index] = { ...db.clients[index], ...req.body, id: clientId }; 
        saveDatabase(db);
        res.json({ success: true, client: db.clients[index] });
    } else {
        res.status(404).json({ success: false, message: 'Client not found' });
    }
});

// ---------------------------------------------------------
// 🗑️ DELETE: Clients (DELETE /api/clients/:id)
// ---------------------------------------------------------
app.delete('/api/clients/:id', (req, res) => {
    const clientId = parseInt(req.params.id);
    const db = loadDatabase();
    const initialLength = db.clients.length;
    
    // Filter out the client with the matching ID
    db.clients = db.clients.filter(c => c.id !== clientId);
    
    if (db.clients.length < initialLength) {
        saveDatabase(db);
        res.json({ success: true, message: 'Client deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Client not found' });
    }
});

app.get('/api/logs', (req, res) => {
    const db = loadDatabase();
    res.json(db.logs);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});