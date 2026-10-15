// These messages are persisted in google_connections.last_error. Match known
// recovery cases explicitly; words such as "권한" also occur in server errors.
export const GOOGLE_RECONNECT_MESSAGE = 'Google 인증 정보를 사용할 수 없습니다. 다시 연결해주세요.';
export const GOOGLE_SCOPE_MESSAGE = '캘린더 접근 권한에 동의해주세요.';
export const GOOGLE_CONFIGURATION_MESSAGE = '서비스의 Google 인증 설정을 확인해야 합니다. 관리자에게 문의해주세요.';

export function requiresGoogleConfiguration(message: string) {
  return [
    GOOGLE_CONFIGURATION_MESSAGE,
    'Google Calendar 서버 연결 설정이 필요합니다.',
    'Google 토큰 암호화 설정이 필요합니다.',
  ].includes(message);
}

const reconnectMessages = new Set([
  GOOGLE_RECONNECT_MESSAGE,
  GOOGLE_SCOPE_MESSAGE,
  'Google 권한이 만료되었습니다. 다시 연결해주세요.',
  'Google 권한을 다시 승인해주세요.',
  '로그인은 완료됐습니다. Calendar 권한은 연결 복구에서 승인해주세요.',
  'Calendar 연결을 취소했거나 권한을 승인하지 않았습니다. 앱 로그인은 유지됩니다.',
  '앱에 로그인한 Google 계정으로 Calendar를 연결해주세요.',
  '기존에 연결한 Google 계정으로 다시 연결해주세요.',
]);

export function requiresGoogleReconnect(message: string) {
  return reconnectMessages.has(message);
}
