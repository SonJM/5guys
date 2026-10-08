type StructuredRequest = {
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  timeoutMs: number;
};

export async function structuredCompletion<T>({
  name,
  schema,
  instructions,
  input,
  maxOutputTokens,
  timeoutMs,
}: StructuredRequest): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("AI 분석 서버 연결 설정이 필요합니다.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: "gpt-6-luna",
      reasoning_effort: "none",
      max_completion_tokens: maxOutputTokens,
      store: false,
      response_format: {
        type: "json_schema",
        json_schema: { name, strict: true, schema },
      },
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    const providerError = await response.json().catch(() => null);
    const code = providerError?.error?.code;
    console.error("OpenAI completion failed", response.status, typeof code === "string" ? code : "unknown");
    if (response.status === 401 || response.status === 403)
      throw new Error("OpenAI API 키 또는 프로젝트 권한을 확인해주세요.");
    if (code === "credit_balance_exhausted" || code === "insufficient_quota")
      throw new Error("OpenAI API 크레딧 또는 사용 한도를 확인해주세요.");
    if (response.status === 429)
      throw new Error("AI 분석 요청이 많거나 사용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.");
    if (response.status === 400 || response.status === 422)
      throw new Error(`AI 분석 요청 형식을 확인해야 합니다. (HTTP ${response.status})`);
    throw new Error(`AI 분석 서비스가 응답하지 않습니다. (HTTP ${response.status})`);
  }

  const result = await response.json();
  const choice = result.choices?.[0];
  if (choice?.message?.refusal)
    throw new Error("AI가 이 근무표 분석을 처리하지 못했습니다.");
  if (choice?.finish_reason === "length")
    throw new Error("AI 분석 결과가 길어 완료되지 않았습니다. 달력 영역을 좁혀 다시 시도해주세요.");
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error("AI 분석 결과가 비어 있습니다. 다시 시도해주세요.");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI 분석 결과 형식이 올바르지 않습니다. 다시 시도해주세요.");
  }
}
