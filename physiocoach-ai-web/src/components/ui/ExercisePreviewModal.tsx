import { ShieldCheck, Dumbbell, Timer, Flame } from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { ExerciseVisual } from './ExerciseVisual';
import { resolveExerciseSafetyNotes } from '../../services/exercise-safety-notes';

export interface ExercisePreviewItem {
  id?: string;
  masterExerciseId?: string | null;
  name: string;
  sets?: number;
  reps?: number | string;
  rpe?: number;
  restSeconds?: number;
  movementPattern?: string;
  muscleGroup?: string;
  targetMuscles?: string[];
  equipment?: string[] | string;
  safetyLevel?: 'safe' | 'caution' | 'avoid' | string;
  safetyNotes?: string;
}

export interface ExercisePreviewModalProps {
  open: boolean;
  exercise: ExercisePreviewItem | null;
  onClose(): void;
}

export function ExercisePreviewModal({
  open,
  exercise,
  onClose,
}: ExercisePreviewModalProps) {
  if (!exercise) return null;

  const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
  const gear = Array.isArray(exercise.equipment) ? exercise.equipment.join(', ') : exercise.equipment;
  const safety = exercise.safetyLevel || 'safe';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise.name}
      maxWidth="lg"
      footer={
        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
          Close Preview
        </Button>
      }
    >
      <div className="space-y-4">
        {/* High-res Exercise Visual Display */}
        <div className="overflow-hidden rounded-xl border border-obsidian-700 bg-obsidian-950">
          <ExerciseVisual
            name={exercise.name}
            masterExerciseId={exercise.masterExerciseId || exercise.id}
            movementPattern={exercise.movementPattern}
            muscleGroup={exercise.muscleGroup || exercise.targetMuscles?.[0]}
            showAttribution={true}
          />
        </div>

        {/* Target Metrics Telemetry Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-obsidian-700 bg-obsidian-950 px-3 py-1.5 font-mono text-sm font-extrabold text-white">
            {exercise.sets || 3} × {exercise.reps || 10}
          </span>

          {exercise.rpe && (
            <span className="flex items-center gap-1 rounded-lg border border-volt/30 bg-volt/10 px-3 py-1.5 font-mono text-xs font-bold text-volt">
              <Flame className="h-3.5 w-3.5" />
              RPE {exercise.rpe}
            </span>
          )}

          {exercise.restSeconds !== undefined && (
            <span className="flex items-center gap-1 rounded-lg border border-obsidian-700 bg-obsidian-950 px-3 py-1.5 font-mono text-xs font-semibold text-slate-300">
              <Timer className="h-3.5 w-3.5 text-cyan-400" />
              {exercise.restSeconds}s rest
            </span>
          )}

          <Badge variant={safety === 'avoid' ? 'danger' : safety === 'caution' ? 'amber' : 'volt'}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            {safety.toUpperCase()}
          </Badge>
        </div>

        {/* Muscle & Equipment Tags */}
        <div className="flex flex-wrap gap-1.5">
          {exercise.movementPattern && (
            <Badge variant="cyan">{exercise.movementPattern}</Badge>
          )}
          {exercise.muscleGroup && (
            <Badge variant="neutral">{exercise.muscleGroup}</Badge>
          )}
          {exercise.targetMuscles?.map((muscle) => (
            <Badge key={muscle} variant="neutral">
              {muscle}
            </Badge>
          ))}
          {gear && (
            <Badge variant="info">
              <Dumbbell className="mr-1 h-3 w-3" />
              {gear}
            </Badge>
          )}
        </div>

        {/* Clinical Safety & Biomechanical Cues */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-400">
            <ShieldCheck className="h-4 w-4" /> Clinical Biomechanical Form Cues
          </p>
          <ul className="mt-2 space-y-1.5">
            {safetyNotes.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-amber-200">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Specific Plan Notes if any */}
        {exercise.safetyNotes && (
          <div className="rounded-xl border border-obsidian-700 bg-obsidian-950 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Special Guidance</span>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{exercise.safetyNotes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
