// Create the PDF off the UI thread; load the PDF engine only when exporting.
export function createPdfJob(character, options, WorkerClass = globalThis.Worker) {
  let worker, timer, rejectJob;
  const promise = new Promise((resolve, reject) => {
    rejectJob = reject;
    if (!WorkerClass) { reject(new Error('PDF export needs a browser with Web Worker support. Please use a current browser.')); return; }
    try {
      worker = new WorkerClass('/pdf-worker.js', { type: 'module' });
      const finish = (error, result) => {
        clearTimeout(timer); worker.terminate();
        error ? reject(new Error(error)) : resolve(result);
      };
      worker.onmessage = ({ data }) => finish(data.error, data.result);
      worker.onerror = () => finish('PDF export could not start. Please reload the page and try again.');
      worker.onmessageerror = () => finish('The PDF result could not be read. Please try again.');
      timer = setTimeout(() => finish('PDF export took too long. Please try a different template.'), 120_000);
      worker.postMessage({ character, options });
    } catch { worker?.terminate(); clearTimeout(timer); reject(new Error('PDF export could not start. Please try again.')); }
  });
  return { promise, cancel() { clearTimeout(timer); worker?.terminate(); rejectJob(new Error('PDF export cancelled.')); } };
}
