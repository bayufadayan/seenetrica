import { useState } from "react";
import { FALLBACK_POSTER } from "../../utils/constants";

export function Poster({ src, alt = "", ...props }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      {...props}
      src={failed ? FALLBACK_POSTER : src || FALLBACK_POSTER}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
