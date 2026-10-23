import OpenAI, { toFile } from 'openai';
import { GoogleGenAI } from '@google/genai';

export interface TranscriptionResult {
  transcript: string;
  providerUsed: string;
  fellBack: boolean;
}

const WHISPER_PROMPT_HINT =
  'Real estate call in India, English and Hinglish: BHK, lakh, crore, RERA, possession, site visit, home loan, EMI, Whitefield, Gachibowli, Hinjewadi, Wakad, Powai, Thane, Sarjapur, carpet area, ready to move.';

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  originalFilename: string
): Promise<TranscriptionResult> {
  const attempts: Array<{
    name: string;
    run: () => Promise<string>;
  }> = [];

  if (process.env.GROQ_API_KEY) {
    const groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    for (const model of ['whisper-large-v3-turbo', 'whisper-large-v3']) {
      attempts.push({
        name: `Groq (${model})`,
        run: async () => {
          const ext = originalFilename.split('.').pop() || 'webm';
          const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });
          const response = await withTimeout(
            groqClient.audio.transcriptions.create({
              file,
              model,
              prompt: WHISPER_PROMPT_HINT,
            }),
            60000,
            `Groq ${model}`
          );
          return response.text || '';
        },
      });
    }
  }

  if (process.env.GEMINI_API_KEY) {
    attempts.push({
      name: 'Gemini Audio (gemini-3.8-flash)',
      run: async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const base64Audio = buffer.toString('base64');
        const response = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/webm',
                      data: base64Audio,
                    },
                  },
                  {
                    text: 'Provide a verbatim transcript of this audio in the original language. When the speaker mixes Hindi and English (Hinglish), write Hindi words in Roman script. Output ONLY the transcript text with no commentary.',
                  },
                ],
              },
            ],
          }),
          60000,
          'Gemini Audio'
        );
        return response.text || '';
      },
    });
  }

  if (attempts.length === 0) {
    throw new Error('We could not transcribe this audio. You can type the notes instead.');
  }

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const rawTranscript = (await attempt.run()).trim();

      // Section 6c: If empty or only a few characters, return a clear message
      if (!rawTranscript || rawTranscript.length < 4) {
        const emptyErr = new Error('We could not hear anything in this recording');
        emptyErr.name = 'EmptyTranscriptError';
        throw emptyErr;
      }

      return {
        transcript: rawTranscript,
        providerUsed: attempt.name,
        fellBack: i > 0,
      };
    } catch (err: any) {
      if (err?.name === 'EmptyTranscriptError') {
        throw err;
      }
      console.warn(`⚠️ [${attempt.name}] transcription failed:`, err?.message || err);
    }
  }

  throw new Error('We could not transcribe this audio. You can type the notes instead.');
}