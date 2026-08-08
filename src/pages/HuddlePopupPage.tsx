import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";

export default function HuddlePopupPage(): React.ReactElement {
  const [params] = useSearchParams();
  const callId = params.get("callId");
  if (callId) {
    const next = new URLSearchParams({ huddleCallId: callId });
    const teamId = params.get("teamId");
    if (teamId) next.set("huddleTeamId", teamId);
    return <Navigate to={{ pathname: "/", search: `?${next.toString()}` }} replace />;
  }
  return <Navigate to="/" replace />;
}
