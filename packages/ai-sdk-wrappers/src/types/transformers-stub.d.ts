// Ambient declaration for optional @huggingface/transformers
// 业务方实际使用本地嵌入时再 npm install 它
declare module '@huggingface/transformers' {
  export const env: {
    allowLocalModels?: boolean;
    allowRemoteModels?: boolean;
    useFs?: boolean;
    localModelPath?: string;
  };

  export function pipeline(
    task: 'feature-extraction',
    model: string,
    opts?: { quantized?: boolean; local?: boolean },
  ): Promise<(
    text: string | string[],
    options: { pooling: 'mean'; normalize: boolean },
  ) => Promise<{ data: Float32Array }>>;
}
