import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePerformance,type InterviewReport} from '@interviewlab/core';
function report(score:number|null,status='observed',rubric='current',evidence=true){return {status:'ready',interview_id:'sample',analysis_metadata:{rubric_version:rubric},dimensions:{technical_knowledge:{status,score,evidence_refs:evidence?[{turn_id:'turn'}]:[],explanation:'样例证据'}}} as unknown as InterviewReport;}
test('performance profile does not turn missing observations into zero or mix rubrics',()=>{
 const result=summarizePerformance([report(80),report(null,'not_observed'),report(20,'observed','old'),report(30,'observed','current',false)]);
 assert.equal(result.dimensions[0].score,80);assert.equal(result.dimensions[0].count,1);assert.equal(result.excluded,1);assert.equal(result.dimensions[1].score,null);
});
test('pending and stale reports cannot become performance conclusions',()=>{
 const a=report(90);a.status='pending';const b=report(80);b.needs_refresh=true;
 assert.equal(summarizePerformance([a,b]).dimensions[0].score,null);
});
