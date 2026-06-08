
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 딥시크 API로 보낼 새로운 FormData 생성
    const deepSeekFormData = new FormData();
    deepSeekFormData.append('file', file);
    
    // 딥시크 API 엔드포인트 URL
    const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/ocr';
    // 딥시크 API 키 (환경 변수에서 가져오기)
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

    if (!DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY가 환경 변수에 설정되지 않았습니다.');
    }

    // 딥시크 API 호출
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        // 'multipart/form-data' 헤더는 fetch가 FormData와 함께 자동으로 설정합니다.
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: deepSeekFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API 오류: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    const ocrResult = result.choices?.[0]?.message?.content || result.text || '';

    // 프론트엔드가 기대하는 { ocrResult: "..." } 형식으로 반환
    return NextResponse.json({ ocrResult });

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
