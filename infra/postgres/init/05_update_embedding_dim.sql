-- Switch embedding dimension from 512 to 128 to match face-api.js FaceRecognitionNet (FaceNet).
-- No enrolled workers yet, so this is safe to run without a data migration.
-- To switch back to 512-dim (e.g., ArcFace ONNX model), reverse this migration.

DROP INDEX IF EXISTS idx_face_embeddings_ivfflat;

ALTER TABLE face_embeddings DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE face_embeddings ADD COLUMN embedding_vector vector(128);

CREATE INDEX idx_face_embeddings_ivfflat
    ON face_embeddings USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);
