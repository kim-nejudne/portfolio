import { Fragment, type CSSProperties } from 'react';
import { urlParts } from '../lib/joinUrl.js';

/**
 * A join address shown without its protocol, which wraps only before a "/" (F155). Any break
 * inside a part waits for the part to be wider than its whole line, a last resort.
 */
export function JoinAddress({
  url,
  className = '',
  style,
}: {
  url: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span style={style} className={`[overflow-wrap:anywhere] ${className}`}>
      {urlParts(url).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
