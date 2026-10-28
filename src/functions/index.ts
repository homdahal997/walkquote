import { analysisDiagnosticFn, analyzeRoomFn } from "@/lib/analyze-room.functions";

export type AnalysisSourceId = "homeowner" | "living" | "bedroom";
export type AnalysisStage = "transcribe" | "observe" | "segment";

export interface AnalyzeRoomRequest {
  operation?: "diagnostic";
  stage?: AnalysisStage;
  sourceId?: AnalysisSourceId;
  sampleId?: "living" | "bedroom";
  attemptId?: string;
  audioBase64?: string;
  transcript?: string;
  frames?: string[];
}

export async function analyzeRoom(request: AnalyzeRoomRequest): Promise<unknown> {
  if (request.operation === "diagnostic") return analysisDiagnosticFn();
  return analyzeRoomFn({ data: request });
}
