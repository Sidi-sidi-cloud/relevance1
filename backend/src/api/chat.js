const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const ai = require('../utils/ai');
const { getWelcomeMessage } = require('../utils/prompts');

const router = express.Router();

// Helper function to get or create user
const getOrCreateUser = async (userId) => {
    if (!userId) {
        userId = uuidv4(); // Genera nuovo ID se non fornito
    }
    let user = await db.query('SELECT * FROM Users WHERE user_id = $1', [userId]);
    if (user.rows.length === 0) {
        // Crea nuovo utente
        const insertResult = await db.query(
            'INSERT INTO Users (user_id, first_seen, last_seen) VALUES ($1, NOW(), NOW()) RETURNING *',
            [userId]
        );
        user = insertResult;
        console.log(`Created new user: ${userId}`);
         return { user: user.rows[0], isNew: true };
    } else {
         // Aggiorna last_seen
        await db.query('UPDATE Users SET last_seen = NOW() WHERE user_id = $1', [userId]);
        console.log(`Existing user found: ${userId}`);
        return { user: user.rows[0], isNew: false };
    }
};


// POST /api/chat
// Body: { userId: string | null, message: string }
// userId: può essere null per il primo messaggio di un utente non ancora identificato
router.post('/', async (req, res) => {
    const { userId: clientUserId, message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: 'Message content is required.' });
    }

    let currentUserId;
    let isNewUser = false;
    let initialMessages = [];

    try {
        // 1. Ottieni o crea l'utente
        const { user, isNew } = await getOrCreateUser(clientUserId);
        currentUserId = user.user_id;
        isNewUser = isNew;

        // 2. Se è un nuovo utente, prepara il messaggio di benvenuto
        if (isNewUser) {
            const welcomeMsg = getWelcomeMessage();
            initialMessages.push({ ...welcomeMsg, user_id: currentUserId, message_id: uuidv4() });
            // Salva il messaggio di benvenuto nel DB (ma non inviarlo a OpenAI)
            await db.query(
                'INSERT INTO Messages (message_id, user_id, sender_type, content, timestamp) VALUES ($1, $2, $3, $4, NOW())',
                [initialMessages[0].message_id, currentUserId, initialMessages[0].sender_type, initialMessages[0].content]
            );
        }

        // 3. Salva il messaggio dell'utente nel DB
        const userMessageId = uuidv4();
        await db.query(
            'INSERT INTO Messages (message_id, user_id, sender_type, content, timestamp) VALUES ($1, $2, $3, $4, NOW())',
            [userMessageId, currentUserId, 'USER', message.trim()]
        );

        // 4. Recupera la cronologia recente per il contesto AI
        const historyResult = await db.query(
            'SELECT sender_type, content FROM Messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2',
            [currentUserId, ai.MAX_CONTEXT_MESSAGES * 2] // Prendi un po' di più per filtrare
        );
        // Inverti per avere l'ordine cronologico corretto per l'API
        const conversationHistory = historyResult.rows.reverse();

        // 5. Ottieni la risposta dall'AI
        // TODO: Recuperare userProfile da DB per passarlo a getAiResponse
        const userProfileResult = await db.query('SELECT profession, main_concerns, relevance_definition, metadata FROM Users WHERE user_id = $1', [currentUserId]);
        const userProfile = userProfileResult.rows[0] || {};

        const aiResponse = await ai.getAiResponse(currentUserId, message.trim(), conversationHistory, userProfile);

        // 6. Salva la risposta dell'AI nel DB
        const aiMessageId = uuidv4();
        await db.query(
            `INSERT INTO Messages (message_id, user_id, sender_type, content, timestamp, openai_model, prompt_tokens, completion_tokens, personality_breakdown)
             VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)`,
            [
                aiMessageId,
                currentUserId,
                'AI',
                aiResponse.content,
                aiResponse.model,
                aiResponse.prompt_tokens,
                aiResponse.completion_tokens,
                aiResponse.personality_breakdown ? JSON.stringify(aiResponse.personality_breakdown) : null
            ]
        );

        // TODO: Estrarre info dal messaggio utente e AI per aggiornare il profilo utente (professione, preoccupazioni, etc.)
        // Esempio molto base:
        if (isNewUser) { // Potrebbe aver risposto alla domanda sulla professione
             // Qui ci vorrebbe un'analisi del 'message' per estrarre la professione
             // updateProfileField(currentUserId, 'profession', extractedProfession);
        }

        // 7. Invia la risposta (e il messaggio di benvenuto se nuovo utente) al client
        const responsePayload = {
            userId: currentUserId, // Invia l'ID utente (nuovo o esistente) al client
            messages: [
                // Include il messaggio di benvenuto solo se è un nuovo utente
                 ...(isNewUser ? [{ id: initialMessages[0].message_id, sender: 'AI', text: initialMessages[0].content, timestamp: new Date().toISOString() }] : []),
                // Include la risposta AI appena generata
                { id: aiMessageId, sender: 'AI', text: aiResponse.content, timestamp: new Date().toISOString() }
            ]
        };

        res.status(200).json(responsePayload);

    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// GET /api/chat/:userId/history
// Recupera la cronologia della chat per un utente
router.get('/:userId/history', async (req, res) => {
    const { userId } = req.params;
    try {
        const historyResult = await db.query(
            `SELECT message_id as id, sender_type as sender, content as text, timestamp
             FROM Messages
             WHERE user_id = $1 ORDER BY timestamp ASC`,
            [userId]
        );
         // Recupera anche i feedback per questi messaggi
        const messageIds = historyResult.rows.map(m => m.id);
        let feedbacks = {};
        if (messageIds.length > 0) {
            const feedbackResult = await db.query(
                `SELECT message_id, feedback_type, comment_content
                 FROM Feedback
                 WHERE message_id = ANY($1::uuid[])`, // Usa l'operatore ANY per cercare in un array di UUID
                [messageIds]
            );
             feedbackResult.rows.forEach(fb => {
                if (!feedbacks[fb.message_id]) {
                    feedbacks[fb.message_id] = [];
                }
                feedbacks[fb.message_id].push({ type: fb.feedback_type, comment: fb.comment_content });
            });
        }

         // Aggiungi i feedback ai messaggi
        const messagesWithFeedback = historyResult.rows.map(msg => ({
            ...msg,
            feedback: feedbacks[msg.id] || [] // Aggiungi un array vuoto se non ci sono feedback
        }));


        res.status(200).json({ messages: messagesWithFeedback });

    } catch (error) {
        console.error(`Error fetching history for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
});


module.exports = router;