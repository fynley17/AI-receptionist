// /routes/api.js

const express = require('express');
const router = express.Router();
// Removed dependency on axios as the only place it was used (call-client) is gone.
const { loadDatabase, saveDatabase } = require('../config/database');

// NOTE: You still need to run 'npm install axios' and 'require('axios')' 
// if you include the booking function, as it uses axios to call Cal.com.
const axios = require('axios'); 

// ---------------------------------------------------------
// 🔗 ENDPOINT: RETELL CUSTOM FUNCTION (Booking)
// POST /api/retell-booking
// ---------------------------------------------------------
router.post('/retell-booking', async (req, res) => {
    const { cal_data, call_id } = req.body;
    const db = loadDatabase();
    
    // 1. Find the client configuration based on the call ID (via the log)
    const logEntry = db.logs.find(log => log.call_id === call_id);
    const client = logEntry ? db.clients.find(c => c.retell_agent_id === logEntry.agent_id) : null;
    
    if (!client) {
        console.error("Booking Error: Client configuration not found.");
        return res.status(404).json({ success: false, message: 'Client configuration not found.' });
    }

    // 2. Prepare Cal.com booking payload
    const payload = {
        eventTypeId: client.cal_event_type_id,
        booking: {
            start: cal_data.start_time,
            end: cal_data.end_time,
            title: `Appointment for ${cal_data.name}`,
            attendees: [
                { name: cal_data.name, email: cal_data.email },
            ],
            timeZone: cal_data.timezone || "America/Los_Angeles", 
            metadata: { cal_data, call_id },
        }
    };

    try {
        // 3. Call Cal.com API using the client's specific API key
        const response = await axios.post('https://api.cal.com/v1/bookings', payload, {
            headers: {
                'Authorization': `Bearer ${client.cal_api_key}`,
                'Content-Type': 'application/json'
            }
        });

        // 4. Update Log on successful booking
        if (response.data.booking) {
             const logIndex = db.logs.findIndex(log => log.call_id === call_id);
             if (logIndex !== -1) {
                 db.logs[logIndex].booked = true; 
                 db.logs[logIndex].cal_booking_id = response.data.booking.id;
                 saveDatabase(db);
             }
        }

        res.json({ 
            success: true, 
            message: 'Booking successful.',
            booking_id: response.data.booking ? response.data.booking.id : null
        });
    } catch (error) {
        // This will print the error if the Cal.com API key is invalid
        console.error("Cal.com Booking Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to create Cal.com booking.' });
    }
});

// ---------------------------------------------------------
// 🔗 ENDPOINT: RETELL WEBHOOK (Call Logger)
// POST /api/retell-webhook
// ---------------------------------------------------------
router.post('/retell-webhook', (req, res) => {
    const webhook = req.body;
    const db = loadDatabase();

    // Find client name for dashboard display
    const client = db.clients.find(c => c.retell_agent_id === webhook.agent_id);
    const client_name = client ? client.name : "Unknown Client";

    // Create a new log entry
    const newLog = {
        call_id: webhook.call_id,
        agent_id: webhook.agent_id,
        client_name: client_name,
        status: webhook.status, 
        transcript: webhook.transcript || "No transcript available yet.",
        booked: false, // Default status
        timestamp: new Date().toISOString(),
    };

    // Replace or add the log entry
    const existingIndex = db.logs.findIndex(log => log.call_id === newLog.call_id);
    if (existingIndex !== -1) {
        db.logs[existingIndex] = { ...db.logs[existingIndex], ...newLog };
    } else {
        db.logs.unshift(newLog);
    }
    
    // Keep only the last 50 logs
    db.logs = db.logs.slice(0, 50);

    saveDatabase(db);

    res.json({ received: true });
});

// ---------------------------------------------------------
// 🖥️ DASHBOARD API (CRUD Operations)
// ---------------------------------------------------------

router.get('/clients', (req, res) => {
    const db = loadDatabase();
    res.json(db.clients);
});

router.post('/clients', (req, res) => {
    const db = loadDatabase();
    const newClient = { id: Date.now(), ...req.body };
    db.clients.push(newClient);
    saveDatabase(db);
    res.json({ success: true, client: newClient });
});

router.put('/clients/:id', (req, res) => {
    const clientId = parseInt(req.params.id);
    const db = loadDatabase();
    const index = db.clients.findIndex(c => c.id === clientId);

    if (index !== -1) {
        db.clients[index] = { ...db.clients[index], ...req.body, id: clientId }; 
        saveDatabase(db);
        res.json({ success: true, client: db.clients[index] });
    } else {
        res.status(404).json({ success: false, message: 'Client not found' });
    }
});

router.delete('/clients/:id', (req, res) => {
    const clientId = parseInt(req.params.id);
    const db = loadDatabase();
    const initialLength = db.clients.length;
    
    db.clients = db.clients.filter(c => c.id !== clientId);
    
    if (db.clients.length < initialLength) {
        saveDatabase(db);
        res.json({ success: true, message: 'Client deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Client not found' });
    }
});

router.get('/logs', (req, res) => {
    const db = loadDatabase();
    res.json(db.logs);
});


module.exports = router;