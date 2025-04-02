-- Tabella Utenti (semplificata, ID generato lato client/backend)
CREATE TABLE IF NOT EXISTS Users (
    user_id UUID PRIMARY KEY,
    first_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- Campi ProfiloUtente base direttamente qui per MVP
    profession VARCHAR(255),
    main_concerns TEXT,
    relevance_definition TEXT,
    metadata JSONB -- Per altri dati raccolti dinamicamente
);

-- Tabella Conversazioni (potrebbe essere ridondante se associamo direttamente messaggi a user_id)
-- Per ora, associamo i messaggi direttamente agli utenti per semplicità MVP.
-- Se necessario, potremo aggiungere una tabella Conversations in seguito.

-- Tabella Messaggi
CREATE TABLE IF NOT EXISTS Messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id),
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('USER', 'AI')), -- 'USER' or 'AI'
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- Dati specifici AI (opzionale per MVP, ma utile)
    openai_model VARCHAR(50),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    -- Personalità usata (stima - può essere complesso, opzionale per MVP)
    personality_breakdown JSONB -- Es: {"coach": 0.4, "analyst": 0.2, ...}
);

-- Tabella Feedback
CREATE TABLE IF NOT EXISTS Feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES Messages(message_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Users(user_id),
    feedback_type VARCHAR(10) NOT NULL CHECK (feedback_type IN ('LIKE', 'DISLIKE', 'COMMENT')),
    comment_content TEXT, -- Usato solo se feedback_type è 'COMMENT'
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON Messages(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON Feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON Feedback(user_id);