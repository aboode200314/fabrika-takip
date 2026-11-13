import { test, expect } from 'bun:test';
import { plannedMinutes } from '../planned-time';
import { isSawMachine, profileLabel } from '../profile-stock';
const sc = { id: 'day', gun: 1, tatil: false, baslangic: '08:00', bitis: '18:00' };
test('08:00–18:00 minus 60 minutes is 540 minutes (9 hours)', () => {
  expect(plannedMinutes('2026-11-09', '2026-11-09', [sc], [{schedule_id:'day', baslangic:'12:00', bitis:'13:00'}])).toBe(540);
});
test('holidays have no planned production', () => {
  expect(plannedMinutes('2026-11-09', '2026-11-09', [{...sc,tatil:true}], [])).toBe(0);
});
test('all selected days use their saved schedules', () => {
 expect(plannedMinutes('2026-11-09','2026-11-10',[sc,{...sc,id:'tue',gun:2}],[])).toBe(1200);
});
test('Trstere and existing TESTERE machine are detected without changing machine data', () => {
 expect(isSawMachine({ad:'Trstere'})).toBe(true);
 expect(isSawMachine({ad:'TESTERE MAKİNASI'})).toBe(true);
 expect(isSawMachine({ad:'CNC PALZMA'})).toBe(false);
});
test('80 x 80 x 6000 x 3 profile retains all specifications', () => {
 expect(profileLabel({id:'p',malzeme_turu:'profil',sac_tipi:'S235',genislik_mm:80,yukseklik_mm:80,uzunluk_mm:6000,kalinlik_mm:3,adet:10,kritik_adet:0,yogunluk:7.85,notlar:null,dis_cap_mm:null,ic_cap_mm:null})).toBe('S235 · 80 × 80 × 6000 × 3 mm');
});
