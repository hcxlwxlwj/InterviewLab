import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ServiceError } from '../../foundation/errors';

/** A graph is a single bounded task execution; database task claims own durable recovery. */
export async function checkedGraph<I, C, O>(
  name: string,
  input: I,
  steps: {
    prepare: (input: I) => Promise<C> | C;
    generate: (context: C) => Promise<unknown>;
    validate: (raw: unknown, context: C) => O;
  },
  signal: AbortSignal,
  log: (entry: object) => void = () => {},
): Promise<O> {
  const State = Annotation.Root({
    input: Annotation<I>(),
    context: Annotation<C>(),
    raw: Annotation<unknown>(),
    result: Annotation<O>(),
  });
  const timed = async <T>(node: string, work: () => Promise<T> | T) => {
    const started = performance.now();
    if (signal.aborted) throw new ServiceError('task_cancelled', 409, '任务已取消');
    try {
      return await work();
    } finally {
      log({ workflow: name, node, duration_ms: Math.round(performance.now() - started) });
    }
  };
  const graph = new StateGraph(State)
    .addNode('prepare_context', async (s) => ({
      context: await timed('prepare_context', () => steps.prepare(s.input)),
    }))
    .addNode('model', async (s) => ({ raw: await timed('model', () => steps.generate(s.context)) }))
    .addNode('validate', async (s) => ({
      result: await timed('validate', () => steps.validate(s.raw, s.context)),
    }))
    .addEdge(START, 'prepare_context')
    .addEdge('prepare_context', 'model')
    .addEdge('model', 'validate')
    .addEdge('validate', END)
    .compile();
  const result = await graph.invoke({ input }, { signal, recursionLimit: 8 });
  if (signal.aborted) throw new ServiceError('task_cancelled', 409, '任务已取消');
  return result.result;
}
