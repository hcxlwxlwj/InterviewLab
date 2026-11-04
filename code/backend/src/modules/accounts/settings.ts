import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PersonalSettings } from '@interviewlab/core';
import type { Database } from '../../database/connection';
import type { MaterialsService } from '../resumes/service';
import type { BackendModule } from '../contracts';
import { unavailable } from '../../foundation/errors';
const settings=z.object({city:z.string().max(100).optional(),career_stage:z.string().max(100).optional(),strengths:z.string().max(3000).optional(),learning_goals:z.string().max(3000).optional(),interaction_mode:z.enum(['text_fallback','realtime_voice']).optional(),interviewer_style:z.enum(['标准','友好','深入追问']).optional(),display_name:z.string().trim().max(80),bio:z.string().max(1000),target_role:z.string().max(100),practice_minutes:z.number().int().min(5).max(120),default_resume_id:z.string().uuid().nullable()}).strict() satisfies z.ZodType<PersonalSettings>;
const defaults: PersonalSettings={display_name:'',bio:'',target_role:'',practice_minutes:20,default_resume_id:null};
export function settingsModule(database?: Database,materials?: MaterialsService): BackendModule {
 return {name:'accounts',async register(instance,context){
 const app=instance.withTypeProvider<ZodTypeProvider>();
 app.get('/me/settings',{schema:{response:{200:settings}}},async request=>{
 const owner=(await context.requireIdentity(request)).owner_id;
 if(!database) throw unavailable('Database');
 const result=await database.pool.query('SELECT data FROM account_settings WHERE owner_id=$1',[owner]);
 const value:PersonalSettings=result.rows[0]?.data ?? defaults;
 if(value.default_resume_id && materials) {
 try {await materials.requireResume(owner,value.default_resume_id);} catch {return {...value,default_resume_id:null};}
 }
 return value;
 });
 app.put('/me/settings',{schema:{body:settings,response:{200:settings}}},async request=>{
 const owner=(await context.requireIdentity(request)).owner_id;
 if(!database || !materials) throw unavailable('Database');
 if(request.body.default_resume_id) await materials.requireResume(owner,request.body.default_resume_id);
 await database.pool.query('INSERT INTO account_settings(owner_id,data) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET data=EXCLUDED.data',[owner,JSON.stringify(request.body)]);
 return request.body;
 });
 }};
}
