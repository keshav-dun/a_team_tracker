// Dynamic import required for ESM module @xenova/transformers in CommonJS project

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EXPECTED_DIMENSIONS = 384;

// Types for the transformers library
interface PipelineOutput {
  data: Float32Array;
}

interface FeatureExtractionPipeline {
  (text: string, options: { pooling: string; normalize: boolean }): Promise<PipelineOutput>;
}

interface TransformersModule {
  pipeline: (task: string, model: string, options?: { quantized: boolean }) => Promise<FeatureExtractionPipeline>;
}

let transformersModule: TransformersModule | null = null;
let embedder: FeatureExtractionPipeline | null = null;
let initPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Load the transformers module using dynamic import
 */
async function getTransformers(): Promise<TransformersModule> {
  if (transformersModule) return transformersModule;
  // Dynamic import for ESM module
  transformersModule = await import('@xenova/transformers') as TransformersModule;
  return transformersModule;
}

/**
 * Initialise (or return cached) the embedding pipeline.
 * The model is loaded once into memory and reused across requests.
 */
async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedder) return embedder;

  // Prevent duplicate init when several requests arrive before the
  // first load completes.
  if (!initPromise) {
    const { pipeline } = await getTransformers();
    initPromise = pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // smaller & faster
    });
  }

  embedder = await initPromise;
  return embedder;
}

/**
 * Embed a single text string and return a plain number[] of length 384.
 * Uses mean-pooling + L2 normalisation (same as sentence-transformers default).
 */
export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  const vector: number[] = Array.from(output.data as Float32Array);

  if (vector.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${vector.length}`
    );
  }

  return vector;
}

/**
 * Eagerly warm up the model so the first real request is fast.
 * Call this at server start-up (fire-and-forget).
 */
export async function warmUpEmbeddings(): Promise<void> {
  try {
    await getEmbedder();
    console.log('✅ Embedding model loaded and ready');
  } catch (err) {
    console.error('⚠️  Failed to pre-load embedding model:', err);
  }
}
