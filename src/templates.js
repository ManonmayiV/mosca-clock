// Starting points for common AI workload data flows.
// Default values are planning guesses meant to be edited, not measurements.

export const TEMPLATES = {
  'training-upload': {
    label: 'Training data upload (on-prem to cloud)',
    hint: 'Raw records move to a training environment. Shelf life is as long as the source data stays sensitive.',
    keyExchange: 'ECDHE-P256', signature: 'RSA-2048', symmetric: 'AES-256-GCM',
    shelfLifeYears: 10, migrationYears: 3, sensitivity: 3, internetFacing: true, handshakesPerDay: 2000,
  },
  'weights-replication': {
    label: 'Model weights replication (cross-region)',
    hint: 'Weights encode the training data and the cost of training. Theft is the risk.',
    keyExchange: 'X25519', signature: 'ECDSA-P256', symmetric: 'AES-256-GCM',
    shelfLifeYears: 5, migrationYears: 2, sensitivity: 3, internetFacing: false, handshakesPerDay: 500,
  },
  'inference-api': {
    label: 'Inference API (external clients)',
    hint: 'Prompts and completions in transit. Shelf life depends on what users type.',
    keyExchange: 'X25519', signature: 'ECDSA-P256', symmetric: 'AES-128-GCM',
    shelfLifeYears: 3, migrationYears: 1, sensitivity: 2, internetFacing: true, handshakesPerDay: 1000000,
  },
  'rag-vector-db': {
    label: 'RAG retrieval (app to vector database)',
    hint: 'Embeddings and retrieved chunks of internal documents.',
    keyExchange: 'ECDHE-P256', signature: 'RSA-2048', symmetric: 'AES-256-GCM',
    shelfLifeYears: 7, migrationYears: 2, sensitivity: 3, internetFacing: false, handshakesPerDay: 200000,
  },
  'model-signing': {
    label: 'Model artifact signing (supply chain)',
    hint: 'Signatures prove a model file has not been swapped. No confidentiality, so no harvest risk.',
    keyExchange: 'none', signature: 'RSA-3072', symmetric: 'none',
    shelfLifeYears: 0, migrationYears: 4, sensitivity: 3, internetFacing: false, longLivedRoot: true, handshakesPerDay: 0,
  },
  'federated-learning': {
    label: 'Federated learning (gradient exchange)',
    hint: 'Gradients can be inverted to recover training examples, so they inherit the data shelf life.',
    keyExchange: 'ECDHE-P256', signature: 'ECDSA-P256', symmetric: 'AES-128-GCM',
    shelfLifeYears: 8, migrationYears: 3, sensitivity: 3, internetFacing: true, handshakesPerDay: 50000,
  },
  'agent-tools': {
    label: 'AI agent to tool calls (API / MCP over TLS)',
    hint: 'Agents pass tokens and business records to tools.',
    keyExchange: 'X25519', signature: 'RSA-2048', symmetric: 'AES-128-GCM',
    shelfLifeYears: 3, migrationYears: 2, sensitivity: 2, internetFacing: true, handshakesPerDay: 300000,
  },
  custom: {
    label: 'Custom workload',
    hint: 'Start from blank values.',
    keyExchange: 'unknown', signature: 'unknown', symmetric: 'unknown',
    shelfLifeYears: 5, migrationYears: 2, sensitivity: 2, internetFacing: false, handshakesPerDay: 0,
  },
};

// Fictional organisation used for the demo. Names and numbers are invented.
export const SAMPLE_INVENTORY = [
  { id: 's1', template: 'training-upload',     name: 'Patient imaging upload to training bucket', ...TEMPLATES['training-upload'], shelfLifeYears: 25, notes: 'Medical records retention; assumed 25 years.' },
  { id: 's2', template: 'rag-vector-db',       name: 'Clinical notes RAG retrieval',               ...TEMPLATES['rag-vector-db'], migrationYears: 3, notes: 'Vector DB vendor has no PQ TLS roadmap yet.' },
  { id: 's3', template: 'inference-api',       name: 'Patient chat assistant API',                 ...TEMPLATES['inference-api'] },
  { id: 's4', template: 'model-signing',       name: 'Radiology model release signing',            ...TEMPLATES['model-signing'] },
  { id: 's5', template: 'weights-replication', name: 'Model weights DR replication',               ...TEMPLATES['weights-replication'] },
  { id: 's6', template: 'agent-tools',         name: 'Scheduling agent to EHR API',                ...TEMPLATES['agent-tools'], keyExchange: 'X25519MLKEM768', signature: 'ML-DSA-65', symmetric: 'AES-256-GCM' },
].map(({ label, hint, ...w }) => w);
