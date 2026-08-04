import { CAVITY_POINT, HINGE, STACK, sources, type LayerName } from '../head';

/**
 * The head, as three stacked images and one hinge.
 *
 * It is `aria-hidden` in its entirety. It is the most expensive thing on the
 * page and it says nothing a screen reader can use — the meaning is in the
 * cards, which are a real list of real links.
 *
 * Two boxes, not one. `.head` is the positioning box the timeline moves; the
 * inner `.canvas` is always exactly the 1200x1600 artboard, so every layer can
 * be placed in percentages of the artwork and stay correct even under reduced
 * motion, where the outer box is shortened to crop the shoulders away.
 */

function Layer({ name }: { name: LayerName }) {
  const { avif, png } = sources(name);
  return (
    <picture>
      <source srcSet={avif} type="image/avif" />
      <img
        src={png}
        alt=""
        aria-hidden="true"
        decoding="async"
        /* The closed head is the first thing painted. Nothing here is lazy. */
        className="layer"
        data-layer={name}
      />
    </picture>
  );
}

export default function Head() {
  const behindLid = STACK.filter((n) => n !== 'lid');

  return (
    <div className="head" data-head aria-hidden="true">
      <div className="canvas">
        {behindLid.map((n) => (
          <Layer key={n} name={n} />
        ))}

        {/*
          The lid, on a hinge at the bottom-right of the tear.

          One plate, not two. The rotation is in the picture plane, so the cap
          never turns away from the viewer and there is no backface to fill —
          which took with it the `perspective`, the `preserve-3d`, the pair of
          z-separated plates, and the bug where `will-change: opacity` on this
          element silently flattened the 3D context and disabled backface
          culling altogether. A mechanism with nothing to get wrong.
        */}
        <div
          className="lid-hinge"
          data-lid
          style={{ transformOrigin: `${HINGE.x}% ${HINGE.y}%` }}
        >
          <Layer name="lid" />
        </div>

        {/*
          A zero-size marker at the mouth of the opening. The cards measure
          their launch point off this rather than recomputing the canvas
          geometry, so the geometry lives in exactly one place — `src/head.ts` —
          and moving the tear cannot silently leave the cards flying out of his
          forehead.

          It outlived the cavity it was named for. Nothing paints the opening
          now; this is the only thing that still knows where it was.
        */}
        <span
          className="cavity-point"
          data-cavity
          style={{ left: `${CAVITY_POINT.x}%`, top: `${CAVITY_POINT.y}%` }}
        />
      </div>
    </div>
  );
}
