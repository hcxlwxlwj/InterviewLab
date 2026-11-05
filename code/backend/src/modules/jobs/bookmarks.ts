import {z} from 'zod';
import type {FastifyInstance} from 'fastify';
import type {ZodTypeProvider} from 'fastify-type-provider-zod';
import type {Database} from '../../database/connection';
import type {ModuleContext} from '../contracts';
import type {JobsService} from './service';
import {unavailable} from '../../foundation/errors';
export async function registerBookmarks(instance:FastifyInstance,context:ModuleContext,service:JobsService,database?:Database){
 const app=instance.withTypeProvider<ZodTypeProvider>();
 const db=()=>{if(!database)throw unavailable('Database');return database;};
 const params=z.object({id:z.string().min(1).max(100)});
 app.get('/bookmarks',{schema:{response:{200:z.array(z.object({id:z.string(),title:z.string(),slug:z.string(),tags:z.array(z.string()),available:z.boolean(),saved_at:z.string()}))}}},async request=>{
 const owner=(await context.requireIdentity(request)).owner_id;
 const result=await db().pool.query('SELECT job_id,created_at FROM job_bookmarks WHERE owner_id=$1 ORDER BY created_at DESC',[owner]);
 return result.rows.map(row=>{try{const job=service.detail(row.job_id);return {id:job.id,title:job.title,slug:job.slug,tags:job.tags,available:true,saved_at:row.created_at.toISOString()};}catch{return {id:row.job_id,title:'该岗位已下架',slug:'',tags:[],available:false,saved_at:row.created_at.toISOString()};}});
 });
 app.get('/bookmarks/:id',{schema:{params,response:{200:z.object({saved:z.boolean()})}}},async request=>{const owner=(await context.requireIdentity(request)).owner_id;const result=await db().pool.query('SELECT 1 FROM job_bookmarks WHERE owner_id=$1 AND job_id=$2',[owner,request.params.id]);return {saved:!!result.rowCount};});
 app.put('/bookmarks/:id',{schema:{params,response:{200:z.object({saved:z.literal(true)})}}},async request=>{const owner=(await context.requireIdentity(request)).owner_id;service.detail(request.params.id);await db().pool.query('INSERT INTO job_bookmarks(owner_id,job_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[owner,request.params.id]);return {saved:true as const};});
 app.delete('/bookmarks/:id',{schema:{params,response:{200:z.object({saved:z.literal(false)})}}},async request=>{const owner=(await context.requireIdentity(request)).owner_id;await db().pool.query('DELETE FROM job_bookmarks WHERE owner_id=$1 AND job_id=$2',[owner,request.params.id]);return {saved:false as const};});
}
