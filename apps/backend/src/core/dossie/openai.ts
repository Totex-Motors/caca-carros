// Cliente minimo da OpenAI (Chat Completions + JSON Schema strict), compartilhado pelo dossie e pela analise de anuncios.

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';

export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.5';

// Modelos de raciocinio (gpt-5*, o*) nao aceitam temperature; usam reasoning_effort.
const IS_REASONING_MODEL = /^(gpt-5|o\d)/.test(OPENAI_MODEL);
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT?.trim() || 'medium';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export class OpenAIConfigError extends Error {}

export async function completeJson(
  messages: ChatMessage[],
  schemaName: string,
  schema: Record<string, unknown>,
  options: { reasoningEffort?: 'low' | 'medium' | 'high' } = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAIConfigError('OPENAI_API_KEY nao configurada');

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      ...(IS_REASONING_MODEL
        ? { reasoning_effort: options.reasoningEffort ?? REASONING_EFFORT }
        : { temperature: 0.2 }),
      messages,
      response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
    }),
    signal: AbortSignal.timeout(240_000)
  });

  if (res.status === 401 || res.status === 403) {
    throw new OpenAIConfigError(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
  const message = body.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`OpenAI recusou: ${message.refusal}`);
  if (!message?.content) throw new Error('OpenAI sem conteudo');
  return message.content;
}
