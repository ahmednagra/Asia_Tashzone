import React from "react";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { Tutorial } from "../features/tutorial/TutorialScreen";

export default function TutorialRoute() {
  return (
    <ErrorBoundary where="the tutorial">
      <Tutorial />
    </ErrorBoundary>
  );
}
