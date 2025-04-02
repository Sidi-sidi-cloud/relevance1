const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/feedback
// Body: { userId: string, messageId: string, feedbackType: 'LIKE' | 'DISLIKE' | 'COMMENT', commentText?: string }
router.post('/', async (req, res) => {
    const { userId, messageId, feedbackType, commentText } = req.body;

    if (!userId || !messageId || !feedbackType) {
        return res.status(400).json({ error: 'Missing required fields (userId, messageId, feedbackType).' });
    }

    if (!['LIKE', 'DISLIKE', 'COMMENT'].includes(feedbackType)) {
        return res.status(400).json({ error: 'Invalid feedbackType.' });
    }

    if (feedbackType === 'COMMENT' && (!commentText || typeof commentText !== 'string' || commentText.trim() === '')) {
         return res.status(400).json({ error: 'Comment text is required for COMMENT feedback type.' });
    }

    try {
        // Verifica che il messaggio esista e appartenga all'utente (opzionale ma consigliato)
        // const msgCheck = await db.query('SELECT user_id FROM Messages WHERE message_id = $1', [messageId]);
        // if (msgCheck.rows.length === 0 /* || msgCheck.rows[0].user_id !== userId */) { // Tollerante sull'user_id per demo
        //     return res.status(404).json({ error: 'Message not found.' });
        // }

        // Inserisci o aggiorna il feedback. Per MVP, inseriamo sempre.
        // Potresti voler logica per impedire like/dislike multipli o aggiornare un commento.
        await db.query(
            `INSERT INTO Feedback (user_id, message_id, feedback_type, comment_content, timestamp)
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, messageId, feedbackType, feedbackType === 'COMMENT' ? commentText.trim() : null]
        );

        res.status(201).json({ success: true, message: 'Feedback received.' });

    } catch (error) {
        console.error('Feedback API error:', error);
        // Controlla errori specifici del DB (es. violazione FK se messageId non esiste)
        if (error.code === '23503') { // foreign_key_violation
             return res.status(404).json({ error: 'Message not found or user invalid.' });
        }
        res.status(500).json({ error: 'Failed to record feedback.' });
    }
});

module.exports = router;