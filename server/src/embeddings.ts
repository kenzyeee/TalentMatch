import { env, pipeline } from '@huggingface/transformers';

const model = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
env.cacheDir = process.env.TRANSFORMERS_CACHE || './.cache/transformers';

type Extractor = (text: string, options: { pooling: 'mean'; normalize: true }) => Promise<{ data: Float32Array | number[] }>;
let extractorPromise: Promise<Extractor> | undefined;

/** Creates a normalized 384-value sentence embedding using all-MiniLM-L6-v2. */
export async function embedText(text: string): Promise<number[]> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', model) as unknown as Promise<Extractor>;
  }
  try {
    const extractor = await extractorPromise;
    const output = await extractor(text.slice(0, 12000), { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);
    if (embedding.length !== 384) throw new Error(`Expected 384 embedding values, received ${embedding.length}`);
    return embedding;
  } catch (error) {
    extractorPromise = undefined;
    throw error;
  }
}

export const toVector = (embedding: number[]) => `[${embedding.join(',')}]`;
