export type ActivityLogRecord = {
  id: string;
  type: "hour" | "contribution";
  memberId: string;
  memberName: string;
  memberRole: string;
  date: string;
  project: string;
  category: string;
  description: string;
  createdAt: string;
  minutes?: number;
  title?: string;
  evidenceUrl?: string | null;
};

export type ActivityLogFilters = {
  person: string;
  type: "all" | ActivityLogRecord["type"];
  from: string;
  to: string;
  search: string;
};

export function filterActivityRecords(
  records: ActivityLogRecord[],
  filters: ActivityLogFilters,
) {
  const query = filters.search.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.person && record.memberId !== filters.person) return false;
    if (filters.type !== "all" && record.type !== filters.type) return false;
    if (filters.from && record.date < filters.from) return false;
    if (filters.to && record.date > filters.to) return false;
    if (!query) return true;
    return [
      record.memberName,
      record.memberRole,
      record.project,
      record.category,
      record.description,
      record.title ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
}
