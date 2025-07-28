
import { NextRequest, NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 인증 정보 설정
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
    const client = new ImageAnnotatorClient({ credentials });

    const buffer = await file.arrayBuffer();
    const image = Buffer.from(buffer).toString('base64');

    const [result] = await client.textDetection({
      image: {
        content: image,
      },
    });

    const detections = result.textAnnotations;
    const ocrResult = detections?.[0]?.description || '';

    return NextResponse.json({ ocrResult });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
