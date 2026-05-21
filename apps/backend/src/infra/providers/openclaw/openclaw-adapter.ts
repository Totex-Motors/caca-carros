import type { OpenClawAnalysisInput, OpenClawAnalysisResult } from './openclaw-types';

export interface OpenClawAdapter {
  isEnabled(): boolean;
  analyze(input: OpenClawAnalysisInput): Promise<OpenClawAnalysisResult | null>;
}
