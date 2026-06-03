export interface PublicTournamentListItem {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
  sportCode?: string;
  organizationName?: string;
  participantCount?: number;
  formatType?: string;
}

export interface PublicTournamentListResponse {
  items: PublicTournamentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
