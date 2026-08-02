'use server';

import { revalidatePath } from 'next/cache';
import { updatePriceCell } from '@/lib/api/pricing';
import type { PriceEdit, PriceEditResult } from '@/lib/types';

export async function savePriceCellAction(edit: PriceEdit): Promise<PriceEditResult> {
  const result = await updatePriceCell(edit);
  if (result.ok) {
    revalidatePath('/admin/pricing');
    revalidatePath('/quote');
    revalidatePath('/app');
  }
  return result;
}
