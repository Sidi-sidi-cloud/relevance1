const OpenAI = require('openai');
const { getBaseSystemPrompt } = require('./prompts');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_CONTEXT_MESSAGES = 10; // Numero di messaggi precedenti da inviare come contesto

const getAiResponse = async (userId, userMessageContent, conversationHistory = [], userProfile = {}) => {
  const systemPrompt = getBaseSystemPrompt(userProfile);

  // Prepara i messaggi per l'API OpenAI
  const messages = [
    { role: 'system', content: systemPrompt },
    // Includi gli ultimi N messaggi della cronologia
    ...conversationHistory
        .slice(-MAX_CONTEXT_MESSAGES) // Prendi solo gli ultimi N messaggi
        .map(msg => ({
            role: msg.sender_type === 'USER' ? 'user' : 'assistant',
            content: msg.content
        })),
    // Aggiungi il nuovo messaggio dell'utente
    { role: 'user', content: userMessageContent },
  ];

  try {
    console.log("Sending to OpenAI API:", JSON.stringify(messages, null, 2)); // Log per debug

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // O un altro modello appropriato (GPT-4 è consigliato per la complessità del prompt)
      messages: messages,
      temperature: 0.7, // Un po' di creatività ma non troppa
      // max_tokens: 500, // Limita la lunghezza della risposta se necessario
      // user: userId, // Utile per il monitoraggio dell'abuso da parte di OpenAI
    });

    console.log("Received from OpenAI API:", JSON.stringify(completion, null, 2)); // Log per debug


    const aiResponseContent = completion.choices[0]?.message?.content?.trim();
    const usage = completion.usage; // { prompt_tokens, completion_tokens, total_tokens }

    if (!aiResponseContent) {
        throw new Error("Empty response from OpenAI");
    }

    return {
      content: aiResponseContent,
      model: completion.model,
      prompt_tokens: usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      // Qui potresti tentare di analizzare aiResponseContent per stimare
      // il breakdown della personalità, ma è complesso e non per MVP.
      personality_breakdown: null,
    };

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    // Gestisci diversi tipi di errore se necessario (rate limit, auth, etc.)
    throw new Error("Failed to get response from AI service.");
  }
};

module.exports = {
  getAiResponse,
};