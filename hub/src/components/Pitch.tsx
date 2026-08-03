/**
 * The rest state.
 *
 * One name, one sentence, one line of evidence. The hub gets about five
 * seconds on a skim, and this is all of the argument that has to survive them
 * — everything else is the work.
 */
export default function Pitch() {
  return (
    <div className="pitch" data-pitch>
      <p className="pitch-name mono">Kim Nejudne — Design Engineer</p>
      <h1 className="pitch-line">
        Full-stack engineer
        <br />
        with a designer&rsquo;s eye.
      </h1>
      <p className="pitch-meta mono">
        Nine years of production JavaScript · An editorial background · Motion that ships at 60fps
      </p>
    </div>
  );
}
