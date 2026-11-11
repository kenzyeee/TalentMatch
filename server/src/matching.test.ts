import { describe,it,expect } from 'vitest';
import { scoreMatch } from './matching.js';
describe('transparent deterministic skill matching',()=>{
 it('weights required skills twice as much as optional skills',()=>{expect(scoreMatch([{name:'PostgreSQL',required:false}],[{name:'PostgreSQL',required:true},{name:'React',required:false}]).score).toBe(66.67);});
 it('normalizes case and reports missing required skills',()=>{const m=scoreMatch([{name:'react',required:false}],[{name:'React',required:true},{name:'SQL',required:true}]); expect(m.score).toBe(50); expect(m.matched).toEqual(['React']); expect(m.missing).toEqual(['SQL']);});
 it('returns zero for jobs without skill criteria',()=>{expect(scoreMatch([],[]).score).toBe(0);});
});
