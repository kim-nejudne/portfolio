import { revalidatePath } from 'next/cache';
import { listStoredArtwork, storeArtwork } from '@/lib/api/uploads';
import { PreflightStreamPoc } from '@/components/poc/preflight-stream-poc';

export default async function PocDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const files = await listStoredArtwork();

  async function upload(formData: FormData) {
    'use server';
    const file = formData.get('artwork');
    if (file instanceof File && file.size > 0) {
      await storeArtwork('FM-2608-0417', file);
    }
    revalidatePath('/poc/FM-2608-0417');
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="num text-2xl">{id}</h1>
      <p className="num text-sm text-muted">tab={tab ?? 'none'}</p>

      <h2 className="mt-8 border-b border-ink pb-1 text-sm font-semibold uppercase tracking-wide">
        Preflight stream
      </h2>
      <PreflightStreamPoc jobId={id} />

      <h2 className="mt-10 border-b border-ink pb-1 text-sm font-semibold uppercase tracking-wide">
        Artwork upload
      </h2>
      <form action={upload} className="mt-4 flex items-center gap-4">
        <label className="num text-sm" htmlFor="artwork">
          PDF/X-4 file
        </label>
        <input id="artwork" name="artwork" type="file" className="text-sm" />
        <button type="submit" className="border border-ink px-3 py-1 num text-sm">
          UPLOAD
        </button>
      </form>
      <ul className="mt-4 num text-sm">
        {files.length === 0 ? (
          <li className="text-muted">No files stored yet.</li>
        ) : (
          files.map((file) => <li key={file.name}>{file.name}</li>)
        )}
      </ul>
    </main>
  );
}
