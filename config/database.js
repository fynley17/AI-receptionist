// /config/database.js

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const INITIAL_DB = {
    clients: [],
    logs: []
};

// Ensure the db.json file exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2));
}

function loadDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading database:", error.message);
        return INITIAL_DB;
    }
}

function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (error) {
        console.error("Error saving database:", error.message);
    }
}

module.exports = { loadDatabase, saveDatabase };