-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users (root entity)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    topic_text TEXT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Table: recordings
CREATE TABLE IF NOT EXISTS recordings (
    recording_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    s3_url TEXT NOT NULL,
    transcript TEXT NOT NULL,
    analysis_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session
        FOREIGN KEY(session_id) 
        REFERENCES sessions(session_id)
        ON DELETE CASCADE
);

-- Table: analytics (atomic metrics per session)
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    filler_word_count INTEGER NOT NULL DEFAULT 0,
    confidence_score NUMERIC(3,1),
    clarity_score NUMERIC(3,1),
    structure_score NUMERIC(3,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analytics_session
        FOREIGN KEY(session_id)
        REFERENCES sessions(session_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_analytics_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Table: generated_topics
CREATE TABLE IF NOT EXISTS generated_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    topic_text TEXT NOT NULL UNIQUE,
    is_behavioral BOOLEAN DEFAULT FALSE,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Create the Storage Bucket for 'recordings' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;
