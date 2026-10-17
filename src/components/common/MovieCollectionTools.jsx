import { Search } from "lucide-react";
import { TITLE_SORT_OPTIONS } from "../../utils/title-sort";

export function MovieCollectionTools({
  collectionName,
  placeholder,
  search,
  type,
  sort,
  onSearchChange,
  onTypeChange,
  onSortChange,
  showSort = true,
}) {
  return (
    <div className={`collection-tools movie-collection-tools ${showSort ? "" : "release-collection-tools"}`}>
      <label className="archive-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search {collectionName}</span>
        <input
          type="search"
          autoComplete="off"
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value.trimStart())}
        />
      </label>
      <label className="form-field">
        <span>Type</span>
        <select value={type} onChange={(event) => onTypeChange(event.target.value)}>
          <option value="all">All types</option>
          <option value="movie">Movies</option>
          <option value="series">Series</option>
        </select>
      </label>
      {showSort && <label className="form-field">
        <span>Sort by</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
          {TITLE_SORT_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>}
    </div>
  );
}
