import { describe, expect, it } from 'vitest';
import { normalizeKey, parsePage, sanitize, scrubContacts } from './fetch-sports';

describe('체육 자료 받기', () => {
  it('응답 한 페이지 읽기 (item 이 하나·여럿·없음)', () => {
    expect(parsePage(JSON.stringify({ response: { header: { resultCode: '00' }, body: { totalCount: '2', items: { item: [{ a: 1 }, { a: null }] } } } }))).toEqual({
      total: 2,
      rows: [{ a: '1' }, { a: '' }],
    });
    expect(parsePage(JSON.stringify({ header: { resultCode: '00' }, body: { totalCount: 1, items: { item: { a: 'x ' } } } })).rows).toEqual([{ a: 'x' }]);
    expect(parsePage(JSON.stringify({ response: { header: { resultCode: '00' }, body: { totalCount: 0, items: '' } } }))).toEqual({ total: 0, rows: [] });
  });

  it('인증키 오류는 다시 시도하지 않는 오류로', () => {
    const xml =
      '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';
    expect(() => parsePage(xml)).toThrow(/30/);
    try {
      parsePage(xml);
    } catch (e) {
      expect((e as { fatal?: boolean }).fatal).toBe(true);
    }
  });

  it('Encoding·Decoding 키 모두 받는다', () => {
    expect(normalizeKey('abc%2Bdef%3D%3D')).toBe('abc+def==');
    expect(normalizeKey(' abc+def== ')).toBe('abc+def==');
  });

  it('개인정보 필드를 버리고 강좌 설명의 연락처를 지운다', () => {
    const [row] = sanitize([{ brno: '1', pres_nm: '홍길동', res_telno: '010-1234-5678', course_seta_desc_cn: '문의 010-1234-5678 a@b.com 주3회' }], ['brno', 'course_seta_desc_cn']);
    expect(row).toEqual({ brno: '1', course_seta_desc_cn: '문의 주3회' });
    expect(scrubContacts('전화 02)123-4567')).toBe('전화');
  });
});
