/** 짧고 바뀌지 않는 이름 (FNV-1a 32비트, 36진수). 파일 이름·내용 버전·학원 id 에 쓴다 */
export function stableName(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
