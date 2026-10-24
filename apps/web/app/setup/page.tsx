import { Centered } from '@/components/auth/centered';
import { SetupWizard } from '@/components/setup/setup-wizard';

/** First steps of a new workspace (right after it was created): office, then people. */
export default function SetupPage() {
  return (
    <Centered>
      <SetupWizard />
    </Centered>
  );
}
