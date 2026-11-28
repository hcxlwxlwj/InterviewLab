import {pgTable,text,timestamp,primaryKey} from 'drizzle-orm/pg-core';
export const jobBookmarks=pgTable('job_bookmarks',{owner_id:text().notNull(),job_id:text().notNull(),created_at:timestamp({withTimezone:true}).notNull().defaultNow()},t=>[primaryKey({columns:[t.owner_id,t.job_id]})]);
