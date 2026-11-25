import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

const cache = {
  institutions: null,
  departments: new Map(),
  specialties: new Map(),
};

async function loadInstitutions() {
  if (!cache.institutions) {
    const response = await api("/v1/reference/institutions");
    cache.institutions = response.items;
  }
  return cache.institutions;
}

async function loadDepartments(etab) {
  if (!etab) return [];
  if (!cache.departments.has(etab)) {
    const response = await api(
      `/v1/reference/departments?${new URLSearchParams({ etab })}`,
    );
    cache.departments.set(etab, response.items);
  }
  return cache.departments.get(etab);
}

async function loadSpecialties(departmentId) {
  if (!departmentId) return [];
  if (!cache.specialties.has(departmentId)) {
    const response = await api(
      `/v1/reference/specialties?${new URLSearchParams({
        department: departmentId,
      })}`,
    );
    cache.specialties.set(departmentId, response.items);
  }
  return cache.specialties.get(departmentId);
}

export function invalidateReferenceData() {
  cache.institutions = null;
  cache.departments.clear();
  cache.specialties.clear();
}

export default function useReferenceData({ etab = "", department = "" } = {}) {
  const [institutions, setInstitutions] = useState(cache.institutions || []);
  const [departments, setDepartments] = useState(
    etab ? cache.departments.get(etab) || [] : [],
  );
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const institutionItems = await loadInstitutions();
        if (active) setInstitutions(institutionItems);
        const departmentItems = await loadDepartments(etab);
        if (active) setDepartments(departmentItems);
        const selectedDepartment = departmentItems.find(
          (item) => item.code === department,
        );
        const specialtyItems = await loadSpecialties(selectedDepartment?.id);
        if (active) setSpecialties(specialtyItems);
      } catch (loadError) {
        if (active) setError(loadError);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [etab, department, retryKey]);

  const getDepartments = useCallback((institutionId) => loadDepartments(institutionId), []);
  const getSpecialties = useCallback((departmentId) => loadSpecialties(departmentId), []);

  return {
    institutions,
    departments,
    specialties,
    loading,
    error,
    retry,
    getDepartments,
    getSpecialties,
  };
}
