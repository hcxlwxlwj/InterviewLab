/** Agent 工具注册与调用轨迹：保留类型及原始错误，仅记录名称、耗时和结果状态。 */
export function defineAgentTool<Args extends unknown[], Result>(
  definition: { name: string; description: string; parameters: readonly string[] },
  execute: (...args: Args) => Promise<Result>,
  log: (entry: object) => void = () => {},
) {
  return {
    ...definition,
    async invoke(...args: Args): Promise<Result> {
      const started = performance.now();
      let status = 'error';
      try {
        const result = await execute(...args);
        status = 'ok';
        return result;
      } finally {
        // 参数和返回值可能包含私有材料，不进入工具轨迹。
        log({
          tool: definition.name,
          duration_ms: Math.round(performance.now() - started),
          status,
        });
      }
    },
  };
}
