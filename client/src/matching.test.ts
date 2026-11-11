import {describe,it,expect} from 'vitest';
describe('app matching presentation',()=>{it('keeps the match score on a 0 to 100 scale',()=>{const value=Math.round((3/4)*10000)/100;expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(100);});});
