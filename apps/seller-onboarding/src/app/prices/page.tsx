import { FormError } from '@/components/form-message';
import { PricesForm } from '@/components/prices-form';
import { StepFrame } from '@/components/step-frame';
import { pricesView } from '@/lib/copy';
import { requireDraft } from '@/lib/draft';
import { MisaRequestError } from '@/lib/misa-client';

export const metadata = { title: 'Review prices' };

export default async function PricesPage() {
  try {
    const draft = await requireDraft();
    return (
      <StepFrame
        wide
        kicker="Step 3 of 4"
        title="Review prices"
        lede="Approve what an agent pays per call. You can change a price or turn an operation off."
      >
        <PricesForm view={pricesView(draft)} />
      </StepFrame>
    );
  } catch (error) {
    if (error instanceof MisaRequestError) {
      return (
        <StepFrame wide kicker="Step 3 of 4" title="Review prices" lede="Approve what an agent pays per call.">
          <FormError message={error.detail} />
        </StepFrame>
      );
    }
    throw error;
  }
}
