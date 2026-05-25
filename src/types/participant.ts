export interface ParticipantListItem {
  id: string;
  displayName: string;
  dateOfBirth: string | null;
  userId: string | null;
}

export interface ParticipantListResponse {
  items: ParticipantListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ParticipantDto {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  notes?: string;
  userId?: string;
}

export interface CreateParticipantRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  notes?: string;
  userId?: string;
}

export interface UpdateParticipantRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  notes?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
