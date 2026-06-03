import { apiClient } from "./client";

export interface ScheduleResult {
  scheduledMatchCount: number;
  unscheduledMatchCount: number;
  estimatedEndTime: string | null;
  schedulingWarnings: string[] | null;
}

function getFilenameFromContentDisposition(
  contentDisposition?: string,
): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

async function downloadPdf(
  url: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await apiClient.get<Blob>(url, {
    responseType: "blob",
  });

  const filename =
    getFilenameFromContentDisposition(response.headers["content-disposition"]) ??
    fallbackFilename;

  triggerBlobDownload(response.data, filename);
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

export async function retimePhase(
  tournamentId: string,
  phaseId: string,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/scheduling/phases/${phaseId}/retime`,
  );
}

export async function downloadParticipantSchedulePdf(
  tournamentId: string,
  phaseId: string,
  participantId: string,
): Promise<void> {
  await downloadPdf(
    `/tournaments/${tournamentId}/phases/${phaseId}/participants/${participantId}/schedule.pdf`,
    `spielplan-teilnehmer-${participantId}.pdf`,
  );
}

export async function downloadGroupSchedulePdf(
  tournamentId: string,
  phaseId: string,
  groupId: string,
): Promise<void> {
  await downloadPdf(
    `/tournaments/${tournamentId}/phases/${phaseId}/groups/${groupId}/schedule.pdf`,
    `spielplan-gruppe-${groupId}.pdf`,
  );

}

export async function downloadPhaseQualifiersPdf(
  tournamentId: string,
  phaseId: string,
): Promise<void> {
  await downloadPdf(
    `/tournaments/${tournamentId}/phases/${phaseId}/qualifiers.pdf`,
    `aufsteiger-${phaseId}.pdf`,
  );
}

export async function downloadFinalRankingPdf(
  tournamentId: string,
  phaseId: string,
): Promise<void> {
  await downloadPdf(
    `/tournaments/${tournamentId}/phases/${phaseId}/final-ranking.pdf`,
    `finale-rangliste-${phaseId}.pdf`,
  );
}

