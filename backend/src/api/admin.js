const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/admin/users
// Lista utenti con qualche dettaglio base
router.get('/users', async (req, res) => {
    try {
        // Ordina per ultimo accesso per vedere i più recenti
        const result = await db.query(
            `SELECT user_id, first_seen, last_seen, profession, main_concerns
             FROM Users
             ORDER BY last_seen DESC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Admin API error (get users):', error);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// GET /api/admin/conversations/:userId
// Ottiene la cronologia completa per un utente specifico, inclusi i feedback
router.get('/conversations/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Usa la stessa query dell'endpoint /api/chat/:userId/history
        const historyResult = await db.query(
            `SELECT message_id as id, sender_type as sender, content as text, timestamp,
                    prompt_tokens, completion_tokens, openai_model -- Aggiungi dati AI per admin
             FROM Messages
             WHERE user_id = $1 ORDER BY timestamp ASC`,
            [userId]
        );

        const messageIds = historyResult.rows.map(m => m.id);
        let feedbacks = {};
        if (messageIds.length > 0) {
             const feedbackResult = await db.query(
                 `SELECT message_id, feedback_type, comment_content, timestamp as feedback_timestamp
                  FROM Feedback
                  WHERE message_id = ANY($1::uuid[])
                  ORDER BY timestamp ASC`, // Ordina anche i feedback
                 [messageIds]
             );
             feedbackResult.rows.forEach(fb => {
                if (!feedbacks[fb.message_id]) {
                    feedbacks[fb.message_id] = [];
                }
                feedbacks[fb.message_id].push({
                    type: fb.feedback_type,
                    comment: fb.comment_content,
                    timestamp: fb.feedback_timestamp
                 });
            });
        }

        const messagesWithFeedback = historyResult.rows.map(msg => ({
            ...msg,
            feedback: feedbacks[msg.id] || []
        }));

        res.status(200).json({ messages: messagesWithFeedback });

    } catch (error) {
        console.error(`Admin API error (get conversation for ${userId}):`, error);
        res.status(500).json({ error: 'Failed to retrieve conversation history.' });
    }
});


module.exports = router;