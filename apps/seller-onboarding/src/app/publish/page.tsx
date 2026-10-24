import Link from 'next/link';

import { FormError } from '@/components/form-message';
import { LiveLinks } from '@/components/live-links';
import { Panel } from '@/components/panel';
import { PublishForm } from '@/components/publish-form';
import { StepFrame } from '@/components/step-frame';
import { Button } from '@/components/ui/button';
import { requireDraft } from '@/lib/draft';
import { MisaRequestError, type Draft, type Published } from '@/lib/misa-client';

export const metadata = { title: 'Go live' };

export default async function PublishPage() {
  try {
    const draft = await requireDraft();
    const live = liveUrls(draft);
    if (live !== undefined) {
      return (
        <StepFrame kicker="Live" title="You're live" lede="Agents can find your API and pay you per call.">
          <Panel title="Share these with agents" description="An agent uses these to find you, read what you sell, and call your API.">
            <LiveLinks links={live} />
            <div className="mt-6">
              <Button asChild size="lg">
                <Link href="/usage">See agent usage</Link>
              </Button>
            </div>
          </Panel>
        </StepFrame>
      );
    }
    return (
      <StepFrame kicker="Step 4 of 4" title="Go live" lede="Choose where agents can find your API.">
        <Panel title="Channels">
          <PublishForm channels={draft.channels} />
        </Panel>
      </StepFrame>
    );
  } catch (error) {
    if (error instanceof MisaRequestError) {
      return (
        <StepFrame kicker="Step 4 of 4" title="Go live" lede="Choose where agents can find your API.">
          <FormError message={error.detail} />
        </StepFrame>
      );
    }
    throw error;
  }
}

function liveUrls(draft: Draft): Published | undefined {
  if (draft.status !== 'live' || draft.door_url === null || draft.listing_url === null || draft.openapi_url === null) return undefined;
  return { door_url: draft.door_url, listing_url: draft.listing_url, openapi_url: draft.openapi_url };
}
