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

  it('개인정보 필드를 버리고 이름 글자의 연락처를 지운다', () => {
    const [row] = sanitize([{ brno: '1', pres_nm: '홍길동', res_telno: '010-1234-5678', course_nm: '헬스 한달(문의 사항:010-3451-1662)' }], ['brno', 'course_nm']);
    expect(row).toEqual({ brno: '1', course_nm: '헬스 한달(문의 사항:)' });
    expect(scrubContacts('전화 02)123-4567')).toBe('전화');
    expect(scrubContacts('010 - 1234 - 5678')).toBe('');
    expect(scrubContacts('010. 1234. 5678')).toBe('');
  });

  it('가린 이름·전화 뒷자리가 적힌 개인 결제창 강좌는 통째로 버린다', () => {
    const personal = [
      '이*람(핸드폰뒤7909) 소수수영 개인결제창',
      '김*현(8825)소수수영(화목)17시',
      '김시*(8825)수영17시화목개인창',
      '최ㅇ준 8월태권도결제창',
      '개인결제(김*유)',
      '[**은] 16/A 어린이수영 외1',
      '[**현, **호] 15/S2 레이저사격',
      '신○찬회원_16A 어린이수영',
      '박시안회원_16B1 어린이수영',
      '김○_16A 어린이수영',
      '(배수＊)18/B1(화목)어린이 소그룹 수영레슨',
      '김*온태권도교육비',
      '김*채 회원님 주짓수 주2회 수업',
      '체육 아동반(정*윤)',
    ];
    const kept = ['[유*초등부] 호신술 및 격투기', '성인주간반(화*목) 클라이밍강습', '어린이수영*주말자유', '연합반 수강(농구) *주2회*', '태권도줄넘기(2026)', '수영 신규회원 소개할인 (주2회)', '* 화목 저녁 성인발레 *'];
    const rows = [...personal, ...kept].map((course_nm) => ({ course_nm }));
    expect(sanitize(rows, ['course_nm']).map((r) => r.course_nm)).toEqual(kept);
  });
});
