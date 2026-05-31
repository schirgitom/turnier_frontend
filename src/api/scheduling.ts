import { apiClient } from "./client";

export interface ScheduleResult {
  scheduledMatchCount: number;
  unscheduledMatchCount: number;
  estimatedEndTime: string | null;
  schedulingWarnings: string[] | null;
}

export async function schedulePhase(
  tournamentId: string,
  phaseId: string,
): Promise<ScheduleResult> {
  const response = await apiClient.post<ScheduleResult>(
    `/tournaments/${tournamentId}/scheduling/phases/${phaseId}/schedule`,
  );
  return response.data;
}
