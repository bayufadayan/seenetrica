import { Outlet } from "react-router-dom";
import { WatchMarvelProvider } from "../context/WatchMarvelProvider";

export function WatchMarvelFeatureLayout() {
  return <WatchMarvelProvider><Outlet /></WatchMarvelProvider>;
}
