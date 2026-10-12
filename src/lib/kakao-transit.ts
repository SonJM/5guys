type Point = { x: string; y: string; place_name: string };
type Step = { properties?: { type?: string; time?: number; guidance?: string; vehicles?: { name?: string }[]; stops?: { name?: string }[] } };
type Route = { properties?: { totalTime?: number; transfers?: number }; steps?: Step[] };

export function kakaoDirectionsUrl(origin: Point, destination: Point, mode: 'transit' | 'car') {
  const point = (p: Point) => `${encodeURIComponent(p.place_name)},${encodeURIComponent(p.y)},${encodeURIComponent(p.x)}`;
  return `https://map.kakao.com/link/by/${mode === 'car' ? 'car' : 'traffic'}/${point(origin)}/${point(destination)}`;
}

export function parseKakaoTransit(value: unknown) {
  const data = value as { status?: string; routes?: Route[] } | null;
  if (data?.status !== 'OK' || !Array.isArray(data.routes))
    throw new Error('이 구간의 대중교통 경로를 확인하지 못했습니다. 카카오맵에서 확인해주세요.');
  const routes = data.routes.filter((route) =>
    route && Number.isFinite(route.properties?.totalTime) && route.properties!.totalTime! > 0 &&
    Array.isArray(route.steps) && route.steps.length > 0 &&
    route.steps.every((step) => step && ['BUS', 'SUBWAY', 'WALKING'].includes(step.properties?.type ?? '') &&
      Number.isFinite(step.properties?.time) && step.properties!.time! >= 0),
  ).sort((a, b) => a.properties!.totalTime! - b.properties!.totalTime!);
  const route = routes[0];
  if (!route) throw new Error('대중교통 경로 정보가 부족합니다. 카카오맵에서 전체 경로를 확인해주세요.');
  const summary = route.steps!.map(({ properties: step }) => {
    if (step!.type === 'WALKING') return `도보 ${Math.ceil(step!.time! / 60)}분`;
    const label = step!.type === 'BUS' ? '버스' : '지하철';
    const names = Array.isArray(step!.vehicles) ? step!.vehicles.map((v) => v?.name).filter((name): name is string => typeof name === 'string').join(', ') : '';
    const stops = Array.isArray(step!.stops) ? step!.stops.map((s) => s?.name).filter((name): name is string => typeof name === 'string') : [];
    return typeof step!.guidance === 'string' && step!.guidance.trim()
      ? step!.guidance.trim().slice(0, 200)
      : `${label}${names ? ` ${names.slice(0, 100)}` : ''}${stops.length ? ` · ${stops[0]} → ${stops.at(-1)}` : ''}`;
  }).join(' / ');
  return { minutes: Math.ceil(route.properties!.totalTime! / 60), summary };
}

export async function fetchKakaoTransit(origin: Point, destination: Point, key: string) {
  const response = await fetch(`https://dapi.kakao.com/v2/routing/publictraffic?${new URLSearchParams({
    start_x: origin.x, start_y: origin.y, end_x: destination.x, end_y: destination.y,
    s_name: origin.place_name, e_name: destination.place_name, input_coord: 'WGS84', output_coord: 'WGS84',
  })}`, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) });
  if (response.status === 401 || response.status === 403) throw new Error('대중교통 연결 설정을 확인해주세요. Kakao 키와 카카오맵 사용 권한이 필요합니다.');
  if (response.status === 429) throw new Error('대중교통 조회 한도에 도달했습니다. 카카오맵에서 확인해주세요.');
  if (!response.ok) throw new Error('대중교통 경로 조회에 실패했습니다. 카카오맵에서 확인해주세요.');
  return parseKakaoTransit(await response.json());
}

export function journeyScore(journeys: { minutes: number | null }[]) {
  if (!journeys.length || journeys.some((j) => typeof j.minutes !== 'number' || !Number.isFinite(j.minutes) || j.minutes <= 0)) return Infinity;
  return Math.max(...journeys.map((j) => j.minutes!));
}
