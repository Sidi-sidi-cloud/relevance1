require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./src/db'); // Importa la configurazione del DB
const chatRoutes = require('./src/api/chat');
const feedbackRoutes = require('./src/api/feedback');
const adminRoutes = require('./src/api/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Abilita CORS per tutte le origini (da restringere in produzione)
app.use(express.json()); // Per parsare body JSON

// Inizializza il Database (opzionale, ma utile per creare le tabelle al primo avvio)
db.initializeDb().catch(console.error);

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);

// Health Check endpoint
app.get('/', (req, res) => {
  res.send('Relevance Backend is running!');
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

// Aggiungi script a package.json per avviare:
// "scripts": {
//   "start": "node server.js",
//   "dev": "nodemon server.js"
// }