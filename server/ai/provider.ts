import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export class AIUnavailableError extends Error {
  constructor(message = 'All AI providers are currently unavailable or failed validation.') {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

export interface StructuredOutputResult<T> {
  data: T;
  providerUsed: string;
  fellBack: boolean;
}

export interface TextOutputResult {
  text: string;
  providerUsed: string;
  fellBack: boolean;
}

// Fast MoE model (3B active params) + Super model + updated Gemini 3.8 Flash + Groq Llama 4
const NVIDIA_FAST_MODEL = 'nvidia/nemotron-3-nano-30b-a3b';
const NVIDIA_SUPER_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';
const GEMINI_MODEL = 'gemini-3.8-flash';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

type ProviderChoice = {
  id: 'nvidia-fast' | 'nvidia-super' | 'gemini' | 'groq';
  model: string;
  label: string;
};

function getConfiguredProviders(): ProviderChoice[] {
  const list: ProviderChoice[] = [];

  if (process.env.NVIDIA_API_KEY) {
    list.push({
      id: 'nvidia-super',
      model: NVIDIA_SUPER_MODEL,
      label: `NVIDIA (${NVIDIA_SUPER_MODEL})`,
    });
  }
  if (process.env.GEMINI_API_KEY) {
    list.push({
      id: 'gemini',
      model: GEMINI_MODEL,
      label: `Gemini (${GEMINI_MODEL})`,
    });
  }
  if (process.env.GROQ_API_KEY) {
    list.push({
      id: 'groq',
      model: GROQ_MODEL,
      label: `Groq (${GROQ_MODEL})`,
    });
  }

  return list;
}

// Strip <think>...</think> blocks, unclosed <think> prefixes, markdown fences, and extract JSON
function extractJsonString(raw: string): string {
  // Remove closed <think>...</think> blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // If there was a </think> tag without an opening <think>, keep everything after </think>
  if (cleaned.includes('</think>')) {
    cleaned = cleaned.split('</think>').pop()!.trim();
  }
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

function cleanChatOutput(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.includes('</think>')) {
    cleaned = cleaned.split('</think>').pop()!.trim();
  }
  return cleaned;
}

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

async function callProviderRaw(
  provider: ProviderChoice,
  systemPrompt: string,
  userPrompt: string,
  expectJson: boolean
): Promise<string> {
  if (provider.id === 'nvidia-fast' || provider.id === 'nvidia-super') {
    const client = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });

    const response = await withTimeout(
      client.chat.completions.create({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 8192,
        messages: [
          {
            role: 'system',
            content: expectJson
              ? `${systemPrompt}\n\nBe concise. Do not output long reasoning—output the JSON object directly.`
              : systemPrompt,
          },
          { role: 'user', content: userPrompt },
        ],
        // Tell NVIDIA NIM Nemotron models not to burn tokens on long <think> traces
        // @ts-ignore - OpenAI SDK passes extra body fields through
        chat_template_kwargs: { enable_thinking: false },
      }),
      60000,
      provider.label
    );
    return response.choices[0]?.message?.content || '';
  }

  if (provider.id === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await withTimeout(
      ai.models.generateContent({
        model: provider.model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          responseMimeType: expectJson ? 'application/json' : 'text/plain',
        },
      }),
      30000,
      provider.label
    );
    return response.text || '';
  }

  // Groq
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  const response = await withTimeout(
    client.chat.completions.create({
      model: provider.model,
      temperature: 0.2,
      response_format: expectJson ? { type: 'json_object' } : undefined,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    25000,
    provider.label
  );
  return response.choices[0]?.message?.content || '';
}

export async function generateStructured<T>({
  systemPrompt,
  userPrompt,
  zodSchema,
}: {
  systemPrompt: string;
  userPrompt: string;
  zodSchema: z.ZodSchema<T>;
}): Promise<StructuredOutputResult<T>> {
  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    throw new AIUnavailableError('No AI API keys are configured on the server.');
  }

  let providerIndex = 0;

  for (const provider of configuredProviders) {
    const fellBack = providerIndex > 0;
    providerIndex++;

    let promptToSend = userPrompt;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const rawText = await callProviderRaw(provider, systemPrompt, promptToSend, true);
        const jsonCandidate = extractJsonString(rawText);
        const parsed = JSON.parse(jsonCandidate);
        const validated = zodSchema.parse(parsed);

        return {
          data: validated,
          providerUsed: provider.label,
          fellBack,
        };
      } catch (err: any) {
        const isValidationOrParseError =
          err instanceof SyntaxError || err instanceof z.ZodError;

        if (attempt === 1 && isValidationOrParseError) {
          const errorDetails =
            err instanceof z.ZodError
              ? JSON.stringify(err.issues)
              : err.message;
          console.warn(
            `⚠️ [${provider.label}] JSON/Zod validation failed on attempt 1 (${err.message}). Retrying once...`
          );
          promptToSend = `${userPrompt}\n\nIMPORTANT RETRY INSTRUCTION: Your previous response failed JSON or schema validation with this error:\n${errorDetails}\nOutput ONLY valid JSON matching the exact schema with no extra text.`;
          continue;
        }

        console.warn(`⚠️ [${provider.label}] failed (attempt ${attempt}):`, err?.message || err);
        break;
      }
    }
  }

  throw new AIUnavailableError();
}

export async function generateText({
  systemPrompt,
  messages,
}: {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<TextOutputResult> {
  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    throw new AIUnavailableError('No AI API keys are configured on the server.');
  }

  const conversationTranscript = messages
    .map((m) => `${m.role === 'user' ? 'Salesperson' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  let providerIndex = 0;
  for (const provider of configuredProviders) {
    const fellBack = providerIndex > 0;
    providerIndex++;

    try {
      const raw = await callProviderRaw(
        provider,
        systemPrompt,
        conversationTranscript,
        false
      );
      const cleaned = cleanChatOutput(raw);
      if (!cleaned) throw new Error('Empty response from provider');

      return {
        text: cleaned,
        providerUsed: provider.label,
        fellBack,
      };
    } catch (err: any) {
      console.warn(`⚠️ [${provider.label}] chat failed:`, err?.message || err);
    }
  }

  throw new AIUnavailableError();
}