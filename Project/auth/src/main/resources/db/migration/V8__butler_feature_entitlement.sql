-- Migration V8: Register BUTLER_AI_ASSISTANT in the platform features catalog
INSERT INTO features (feature_key, name, description, category, active, limits_supported)
VALUES (
    'BUTLER_AI_ASSISTANT',
    'Butler AI Assistant',
    'Conversational AI Restaurant Agent and Customer Personal Dining Assistant powered by LangGraph and Groq.',
    'AI_INTELLIGENCE',
    TRUE,
    TRUE
)
ON CONFLICT (feature_key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    active = TRUE,
    limits_supported = TRUE;
