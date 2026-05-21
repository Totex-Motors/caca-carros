import type { OpenClawAdapter } from './openclaw-adapter';
import type { OpenClawAnalysisInput, OpenClawAnalysisResult } from './openclaw-types';

export class OpenClawDisabledAdapter implements OpenClawAdapter {
  isEnabled(): boolean {
    return false;
  }

  async analyze(_input: OpenClawAnalysisInput): Promise<OpenClawAnalysisResult | null> {
    return null;
  }
}
