import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { COHORT, DEFAULT_COHORTS, belongsToCohort, cohortLabel, recordCohortId, sortCohorts } from "../data/cohort";

export default function useAdminCohort(records = []) {
  const [params, setParams] = useSearchParams();
  const [catalogue, setCatalogue] = useState(DEFAULT_COHORTS);
  const [catalogueError, setCatalogueError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/cohorts', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Cohorts unavailable'); return response.json(); })
      .then((data) => {
        if (!Array.isArray(data.cohorts) || !data.cohorts.length) throw new Error('Invalid cohort catalogue');
        setCatalogue(data.cohorts); setCatalogueError(false);
      }).catch((error) => { if (error.name !== 'AbortError') setCatalogueError(true); });
    return () => controller.abort();
  }, []);
  const cohorts = useMemo(() => sortCohorts([
    ...records.map((record) => ({ id: recordCohortId(record), label: cohortLabel(recordCohortId(record)) })),
    ...catalogue,
  ]), [records, catalogue]);
  const requested = params.get('cohort');
  const selectedId = cohorts.some((item) => item.id === requested) ? requested : cohorts[0]?.id || COHORT.id;
  const selected = cohorts.find((item) => item.id === selectedId);
  const setSelectedId = (id) => setParams((current) => {
    const next = new URLSearchParams(current); next.set('cohort', id); return next;
  }, { replace: true });
  const scopedRecords = useMemo(() => records.filter((record) => belongsToCohort(record, selectedId)), [records, selectedId]);
  return { cohorts, selected, selectedId, setSelectedId, scopedRecords, catalogueError };
}
