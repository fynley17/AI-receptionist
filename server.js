// server.js

// Removed require('dotenv').config() as Retell API key is no longer needed 
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Import the API Router
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------
// Middleware Setup
// ---------------------------------------------------------
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(express.static('public')); 

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
// Start Server
// ---------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});