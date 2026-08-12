import { Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";

export function CategoryIcon({ category, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [category.iconUrl]);
  if (!category.iconUrl || failed) {
    return <Clapperboard className={className} aria-hidden="true" />;
  }
  return (
    <img
      className={className}
      src={category.iconUrl}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}
