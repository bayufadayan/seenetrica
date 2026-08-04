export const storage = {
  get(key, fallbackValue = null, target = window.localStorage) {
    try {
      const value = target.getItem(key);
      return value === null ? fallbackValue : JSON.parse(value);
    } catch {
      try {
        target.removeItem(key);
      } catch {
        // Storage may be unavailable.
      }
      return fallbackValue;
    }
  },
  set(key, value, target = window.localStorage) {
    try {
      target.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key, target = window.localStorage) {
    try {
      target.removeItem(key);
    } catch {
      // Storage may be unavailable.
    }
  },
};
