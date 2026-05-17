export interface ParticipantDto {
  id: string;
  name: string;
  email: string;
}

export interface CreateParticipantRequest {
  name: string;
  email: string;
}

export interface UpdateParticipantRequest {
  name?: string;
  email?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
