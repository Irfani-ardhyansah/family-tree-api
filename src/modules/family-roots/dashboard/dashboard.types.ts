import { EventItem } from '../events/events.types';
import { DeceasedListItem } from '../memoriam/memoriam.types';
import { ReadFocusMeta } from '../persons/persons.types';

export type DashboardFocusPerson = {
  id: number;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  gender: 'male' | 'female';
};

export type DashboardStats = {
  memberCount: number;
  generationCount: number;
  photoCount: number;
  upcomingEventCount: number;
};

export type DashboardMemoriamItem = DeceasedListItem & {
  canAccess: boolean;
  latestTributeAt: string | null;
};

export type DashboardQuery = {
  recentLimit: number;
  upcomingLimit: number;
  memoriamLimit: number;
};

export type DashboardResponse = ReadFocusMeta & {
  selfPersonId: number;
  focusPerson: DashboardFocusPerson;
  stats: DashboardStats;
  recentEvents: EventItem[];
  upcomingEvents: EventItem[];
  recentMemoriam: DashboardMemoriamItem[];
};
