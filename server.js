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
// Route Setup
// ---------------------------------------------------------

// Mount the API Router: All routes in api.js will be prefixed with '/api'
app.use('/api', apiRouter); 

// Fallback: Serve the index.html for all other GET requests
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------
// Start Server
// ---------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});