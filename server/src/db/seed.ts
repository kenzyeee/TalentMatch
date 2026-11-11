import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const client=await pool.connect();
try {
 await client.query('BEGIN');
 const skills=['TypeScript','React','Node.js','PostgreSQL','Python','Docker','Redis','REST APIs','AWS','Communication','Product design','Figma','User research','Accessibility'];
 for(const n of skills) await client.query('INSERT INTO skills(name,"normalizedName") VALUES($1,$2) ON CONFLICT(name) DO NOTHING',[n,n.toLowerCase()]);
 const admin=await client.query("SELECT id FROM users WHERE email='admin@talentmatch.dev'");
 if(!admin.rowCount){const hash=await bcrypt.hash('Admin123!',12);await client.query("INSERT INTO users(email,\"passwordHash\",\"userType\") VALUES('admin@talentmatch.dev',$1,'ADMIN')",[hash]);}

 let recruiter=await client.query("SELECT r.id FROM recruiters r JOIN users u ON u.id=r.\"userId\" WHERE u.email='demo.recruiter@talentmatch.dev'");
 if(!recruiter.rowCount){
  const hash=await bcrypt.hash('Recruiter123!',12);const u=await client.query("INSERT INTO users(email,\"passwordHash\",\"userType\") VALUES('demo.recruiter@talentmatch.dev',$1,'RECRUITER') RETURNING id",[hash]);
  recruiter=await client.query('INSERT INTO recruiters("userId","companyName","firstName","lastName","companyWebsite") VALUES($1,$2,$3,$4,$5) RETURNING id',[u.rows[0].id,'Northstar Labs','Morgan','Reed','https://example.com']);
 }
 const existing=await client.query('SELECT count(*)::int AS n FROM jobs WHERE "recruiterId"=$1',[recruiter.rows[0].id]);
 if(existing.rows[0].n===0){
  const postings=[
   {title:'Frontend Engineer',description:'Help us build thoughtful, accessible web experiences. You will work closely with design and product to ship features in a modern React and TypeScript application, improve performance, and make our UI system easier to use.',location:'Remote · North America',type:'Full-time',work:'REMOTE',min:105000,max:145000,skills:[['React',true],['TypeScript',true],['Accessibility',false],['REST APIs',false]]},
   {title:'Backend Engineer, Data Platform',description:'Design reliable APIs and data services for a growing product team. You will shape our PostgreSQL schemas, build Node.js services, and help us operate clear, observable systems as our customers grow.',location:'New York, NY',type:'Full-time',work:'HYBRID',min:125000,max:165000,skills:[['Node.js',true],['PostgreSQL',true],['Docker',false],['Redis',false]]},
   {title:'Product Designer',description:'Turn complex workflows into calm, intuitive product experiences. Partner with product and engineering from early research through polished interaction details, and help evolve our design system.',location:'Remote · United States',type:'Full-time',work:'REMOTE',min:95000,max:135000,skills:[['Product design',true],['Figma',true],['User research',false],['Accessibility',false]]}
  ];
  for(const j of postings){const inserted=await client.query('INSERT INTO jobs("recruiterId",title,description,location,"employmentType","workplaceType","salaryMin","salaryMax",status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'OPEN\') RETURNING id',[recruiter.rows[0].id,j.title,j.description,j.location,j.type,j.work,j.min,j.max]);for(const [name,required] of j.skills){const sk=await client.query('SELECT id FROM skills WHERE name=$1',[name]);await client.query('INSERT INTO job_skills("jobId","skillId","isRequired") VALUES($1,$2,$3) ON CONFLICT("jobId","skillId") DO NOTHING',[inserted.rows[0].id,sk.rows[0].id,required]);}}
 }
 await client.query('COMMIT');
 console.log('Seed complete. Admin: admin@talentmatch.dev / Admin123! Recruiter: demo.recruiter@talentmatch.dev / Recruiter123!');
} catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();await pool.end();}
