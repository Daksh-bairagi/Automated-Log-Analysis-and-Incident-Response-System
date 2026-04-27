import React from 'react';

const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function IncidentFilters({
  severityFilter,
  onSeverityChange,
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
}) {
  return (
    <div className="filters-bar" id="incident-filters">
      <div className="filter-chip-group">
        {FILTERS.map((level) => (
          <button
            key={level}
            className={`filter-chip ${severityFilter === level ? 'active' : ''}`}
            onClick={() => onSeverityChange(level)}
            id={`filter-${level.toLowerCase()}`}
          >
            {level === 'ALL' ? 'All severities' : level}
          </button>
        ))}
      </div>

      <label className="search-field" htmlFor="incident-search">
        <span>Search</span>
        <input
          id="incident-search"
          type="text"
          placeholder="Search message, source, or id"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="filters-summary">
        {filteredCount} of {totalCount} incidents
      </div>
    </div>
  );
}
