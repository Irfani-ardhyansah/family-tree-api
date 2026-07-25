/** Akses event: kosong = terbuka; ada attendee = hanya mereka yang boleh detail + kontribusi. */
export function canAccessEvent(attendeeIds: number[], viewerPersonId: number): boolean {
  if (attendeeIds.length === 0) {
    return true;
  }
  return attendeeIds.includes(viewerPersonId);
}

export function isRestrictedEvent(attendeeIds: number[]): boolean {
  return attendeeIds.length > 0;
}

/** Update/delete event hanya boleh creator. */
export function canManageEvent(createdByPersonId: number, viewerPersonId: number): boolean {
  return createdByPersonId === viewerPersonId;
}

/** Event tampil di list jika personIds kosong atau ada overlap dengan visible subgraph. */
export function isEventVisibleInPerspective(
  personIds: number[],
  visiblePersonIds: Set<number>,
): boolean {
  if (personIds.length === 0) {
    return true;
  }
  return personIds.some((id) => visiblePersonIds.has(id));
}
