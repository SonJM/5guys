import { NextRequest, NextResponse } from 'next/server'

type WorkPatternEntry = {
  label: string
  code: string
  startTime?: string | null
  endTime?: string | null
}

type AnalyzeRequestBody = {
  ocrText: string
  workPatternMap: WorkPatternEntry[]
  year: number
  month: number
}

type ParsedSchedule = {
  date: string
  status: string
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await req.json()
    const { ocrText, workPatternMap, year, month } = body

    if (!ocrText) {
      return NextResponse.json({ error: 'OCR 텍스트가 없습니다.' }, { status: 400 })
    }

    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
    }

    const mappingSection =
      workPatternMap.length > 0
        ? workPatternMap
            .map(p => {
              const time = p.startTime && p.endTime ? ` (${p.startTime}~${p.endTime})` : ''
              return `- 이미지 표기 "${p.label}" → 코드: ${p.code}${time}`
            })
            .join('\n')
        : '(등록된 매핑 없음 — 이미지 내 텍스트를 기반으로 직접 추론하세요)'

    const prompt = `당신은 근무표 파싱 전문가입니다.

사용자의 근무표 표기 매핑:
${mappingSection}

아래는 ${year}년 ${month}월 근무표에서 OCR로 추출된 텍스트입니다:
---
${ocrText}
---

위 매핑을 참고하여 날짜별 근무 코드를 추출하세요.
- 매핑에 없는 표기는 가장 유사한 코드(A, B, C, 휴무 중 하나)로 추론하세요.
- 날짜가 명확하지 않은 항목은 건너뜁니다.
- 날짜 형식: ${year}-${String(month).padStart(2, '0')}-DD

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
[{"date":"${year}-${String(month).padStart(2, '0')}-01","status":"A"},{"date":"${year}-${String(month).padStart(2, '0')}-02","status":"휴무"}]`

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API 오류: ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'LLM이 올바른 JSON을 반환하지 않았습니다.', raw: content }, { status: 422 })
    }

    const schedules: ParsedSchedule[] = JSON.parse(jsonMatch[0])

    const validStatuses = new Set(['A', 'B', 'C', '휴무', '약속'])
    const filtered = schedules.filter(
      s => s.date && s.status && validStatuses.has(s.status)
    )

    return NextResponse.json({ schedules: filtered })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
