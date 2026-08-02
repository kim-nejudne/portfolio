import { addCommentAction } from '@/lib/actions/jobs';
import { formatDateTime } from '@/lib/dates';
import { ROLE_LABEL } from '@/lib/api/session';
import type { JobComment } from '@/lib/types';

export function CommentThread({
  reference,
  comments,
}: {
  reference: string;
  comments: readonly JobComment[];
}) {
  return (
    <section aria-labelledby="thread" className="border border-rule-strong">
      <div className="flex items-center justify-between border-b-2 border-rule-strong px-3 py-2">
        <h2 id="thread" className="label-caps">
          Job thread
        </h2>
        <span className="num text-2xs text-muted">{comments.length} entries</span>
      </div>
      {comments.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted" data-testid="empty-state">
          Nothing on the thread. Anything written here stays on the job record, so use it for
          decisions rather than chat.
        </p>
      ) : (
        <ol className="divide-y divide-rule">
          {comments.map((comment) => (
            <li key={comment.id} className="px-3 py-3">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm font-semibold">{comment.author}</span>
                <span className="label-caps text-muted">{ROLE_LABEL[comment.role]}</span>
                <span className="num text-2xs text-muted">{formatDateTime(comment.at)}</span>
              </p>
              <p className="mt-1 text-sm">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form action={addCommentAction} className="border-t border-rule px-3 py-3">
        <input type="hidden" name="reference" value={reference} />
        <label htmlFor="comment-body" className="label-caps text-muted">
          Add to the thread
        </label>
        <textarea
          id="comment-body"
          name="body"
          rows={2}
          required
          className="mt-1 w-full border border-rule-strong bg-paper px-2 py-1 text-sm focus:border-ink"
          data-testid="comment-body"
        />
        <button
          type="submit"
          data-testid="comment-submit"
          className="mt-2 border border-ink px-3 py-1.5 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
        >
          Post
        </button>
      </form>
    </section>
  );
}
