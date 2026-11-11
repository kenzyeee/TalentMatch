export type Skill = { name:string; required:boolean; years?:number };
export function scoreMatch(resume:Skill[], job:Skill[]) {
 const normalized=new Map(resume.map(s=>[s.name.trim().toLowerCase(),s]));
 const required=job.filter(s=>s.required); const optional=job.filter(s=>!s.required);
 const matchedRequired=required.filter(s=>normalized.has(s.name.trim().toLowerCase()));
 const matchedOptional=optional.filter(s=>normalized.has(s.name.trim().toLowerCase()));
 const denominator=required.length*2+optional.length;
 const points=matchedRequired.length*2+matchedOptional.length;
 const score=denominator===0?0:Math.round(points/denominator*10000)/100;
 const matched=[...matchedRequired,...matchedOptional].map(s=>s.name);
 const missing=[...required.filter(s=>!normalized.has(s.name.trim().toLowerCase()))].map(s=>s.name);
 return {score,matched,missing,breakdown:{method:'weighted-skill-overlap-v1',requiredMatched:matchedRequired.length,requiredTotal:required.length,optionalMatched:matchedOptional.length,optionalTotal:optional.length,weights:{required:2,optional:1},inputs:job.map(s=>({skill:s.name,required:s.required,present:normalized.has(s.name.trim().toLowerCase())}))}};
}
