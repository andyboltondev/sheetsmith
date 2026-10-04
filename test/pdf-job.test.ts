import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Browser module shared with the worker lifecycle tests.
import { createPdfJob } from '../public/pdf-job.js';
class FakeWorker {
 static latest: FakeWorker;
 stopped=false;message:any;onmessage:any;onerror:any;onmessageerror:any;
 url:string;options:any;
 constructor(url:string,options:any){this.url=url;this.options=options;FakeWorker.latest=this;}
 postMessage(message:any){this.message=message;}
 terminate(){this.stopped=true;}
}
test('PDF worker starts on request, sends options and terminates after success',async()=>{
 const job=createPdfJob({identity:{name:'Test'}},{templateId:'official-standard'},FakeWorker);const worker=FakeWorker.latest;
 assert.equal(worker.options.type,'module');assert.equal(worker.message.options.templateId,'official-standard');
 worker.onmessage({data:{result:{bytes:new Uint8Array([1,2]),warnings:[]}}});
 assert.deepEqual((await job.promise).bytes,new Uint8Array([1,2]));assert.equal(worker.stopped,true);
});
test('PDF cancellation terminates worker and rejects outstanding export',async()=>{
 const job=createPdfJob({}, {}, FakeWorker);const rejection=assert.rejects(job.promise,/cancelled/);job.cancel();await rejection;assert.equal(FakeWorker.latest.stopped,true);
});
test('worker failures surface actionable errors and clean up',async()=>{
 const job=createPdfJob({}, {}, FakeWorker);const rejection=assert.rejects(job.promise,/could not start/);FakeWorker.latest.onerror();await rejection;assert.equal(FakeWorker.latest.stopped,true);
});
