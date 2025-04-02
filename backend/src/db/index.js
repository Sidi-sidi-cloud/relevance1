const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { // Aggiungi se necessario per connessioni remote (es. Heroku, Render)
  //   rejectUnauthorized: false
  // }
});

pool.on('connect', () => {
  console.log('Connected to the Database');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // Esponi pool se necessario per transazioni etc.
};

// Funzione per inizializzare il DB (eseguire schema.sql)
const initializeDb = async () => {
    const fs = require('fs');
    const path = require('path');
    try {
        console.log('Initializing database schema...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(schemaSql);
        console.log('Database schema initialized successfully.');
    } catch (err) {
        console.error('Error initializing database schema:', err);
    }
    // Non chiudere il pool qui se il server deve continuare a funzionare
};

// Esporta la funzione di inizializzazione per poterla chiamare all'avvio del server
module.exports.initializeDb = initializeDb;