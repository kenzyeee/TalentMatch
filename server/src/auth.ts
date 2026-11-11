import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
export type Role='CANDIDATE'|'RECRUITER'|'ADMIN';
export type AuthUser={id:string;email:string;role:Role;profileId?:string};
declare global { namespace Express { interface Request { user?:AuthUser } } }
const secret=()=>process.env.JWT_SECRET || 'development-only-secret-change-me';
export function token(user:AuthUser){return jwt.sign(user,secret(),{expiresIn:'7d'});}
export function auth(req:Request,res:Response,next:NextFunction){const h=req.headers.authorization; if(!h?.startsWith('Bearer ')) return res.status(401).json({error:'Sign in to continue'}); try{req.user=jwt.verify(h.slice(7),secret()) as AuthUser; next();}catch{return res.status(401).json({error:'Session expired. Sign in again.'});}}
export function allow(...roles:Role[]){return (req:Request,res:Response,next:NextFunction)=>{if(!req.user||!roles.includes(req.user.role))return res.status(403).json({error:'You do not have access to this action'});next();};}
