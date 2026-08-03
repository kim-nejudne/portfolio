import { CAVITY_POINT, EYE_BOX, HINGE, SKY_CLIP, STACK, sources, type LayerName } from '../head';

/**
 * The head, as nine stacked images and one 3D hinge.
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

const isEye = (n: LayerName) => n === 'eyes-forward' || n === 'eyes-up';

function Layer({ name }: { name: LayerName }) {
  const { avif, png } = sources(name);
  const eye = isEye(name);
  return (
    <picture>
      <source srcSet={avif} type="image/avif" />
      <img
        src={png}
        alt=""
        aria-hidden="true"
        decoding="async"
        /* The closed head is the first thing painted. Nothing here is lazy. */
        className={eye ? 'layer layer-eye' : 'layer'}
        data-layer={name}
        style={
          eye
            ? {
                left: `${EYE_BOX.left}%`,
                top: `${EYE_BOX.top}%`,
                width: `${EYE_BOX.width}%`,
                height: `${EYE_BOX.height}%`,
              }
            : undefined
        }
      />
    </picture>
  );
}

export default function Head() {
  const behindLid = STACK.filter((n) => n !== 'lid' && n !== 'lid-underside');

  return (
    <div className="head" data-head aria-hidden="true">
      <div className="canvas">
        {behindLid.map((n) =>
          n === 'sky' ? (
            /* The sky can only ever be seen through the opening. See SKY_CLIP. */
            <span key={n} className="sky-clip" style={{ clipPath: SKY_CLIP }}>
              <Layer name={n} />
            </span>
          ) : (
            <Layer key={n} name={n} />
          ),
        )}

        {/*
          The lid and its underside share one rotating wrapper and face opposite
          ways, so the browser decides which is visible from the angle. At the
          angle we actually use the underside barely peeks — but wiring it as a
          real backface rather than an opacity cross-fade means the hinge stays
          correct if the angle is re-tuned past vertical once the real crown
          exists, which is the likeliest change the artwork will force.
        */}
        <div
          className="lid-hinge"
          data-lid
          style={{ transformOrigin: `${HINGE.x}% ${HINGE.y}%` }}
        >
          <div className="lid-plate lid-front">
            <Layer name="lid" />
          </div>
          <div className="lid-plate lid-back">
            <Layer name="lid-underside" />
          </div>
        </div>

        {/*
          A zero-size marker at the centre of the opening. The cards measure
          their launch point off this rather than recomputing the canvas
          geometry, so the geometry lives in exactly one place — `src/head.ts` —
          and moving the cut line cannot silently leave the cards flying out of
          his forehead.
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
