import { Navigate } from 'react-router-dom';

export function ExercisesPage() {
  return <Navigate to="/explore?tab=exercises" replace />;
}
