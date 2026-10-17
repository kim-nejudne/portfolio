// `/m/:module` (spec §6): the module's summary, prerequisites and lessons in order. F9.
import { useParams } from 'react-router';
import { Placeholder } from './placeholder';

export function ModulePage() {
  const { module } = useParams();
  return (
    <Placeholder
      title={`Module ${module ?? ''}`.trim()}
      feature="F9 (roadmap, modules and progress)"
    />
  );
}
