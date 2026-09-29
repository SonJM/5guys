import { NextRequest, NextResponse } from "next/server";
import { apiError, limited, session } from "@/lib/server";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    const { db } = await session();
    await limited(db, "ocr", 20);
    if (Number(req.headers.get("content-length") ?? 0) > 4500000)
      throw new Error("이미지는 4MB 이하로 올려주세요.");
    const data = await req.formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size > 4000000 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      throw new Error("4MB 이하의 PNG, JPEG, WebP 이미지를 선택해주세요.");
    const key = process.env.GOOGLE_VISION_API_KEY;
    if (!key)
      return NextResponse.json(
        {
          error:
            "이미지 인식 연결이 아직 준비되지 않았습니다. 아래에 날짜와 근무 표기를 직접 입력해 분석할 수 있습니다.",
        },
        { status: 503 },
      );
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(40000),
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: Buffer.from(await file.arrayBuffer()).toString(
                  "base64",
                ),
              },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              imageContext: { languageHints: ["ko", "en"] },
            },
          ],
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        "이미지 인식 서비스 호출에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    const result = (await response.json()).responses?.[0];
    if (result?.error)
      throw new Error(
        "이미지를 인식하지 못했습니다. 달력 영역과 해상도를 확인해주세요.",
      );
    const words = (result?.textAnnotations ?? [])
      .slice(1)
      .map(
        (word: {
          description: string;
          boundingPoly?: { vertices?: { x?: number; y?: number }[] };
        }) => ({
          text: word.description,
          vertices: word.boundingPoly?.vertices,
        }),
      );
    return NextResponse.json({
      ocrResult: result?.fullTextAnnotation?.text ?? "",
      layout: words.slice(0, 1500),
    });
  } catch (e) {
    return apiError(e);
  }
}
