// The F1 placeholder every §6 route renders until its feature lands: the page name as the h1,
// the route parameters in mono, and the feature that fills it.
export function Placeholder({
  title,
  detail,
  feature,
}: {
  title: string;
  detail?: string | undefined;
  feature: string;
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {detail !== undefined && (
        <p className="font-mono text-sm text-muted-foreground">{detail}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Placeholder: {feature} fills this page.
      </p>
    </section>
  );
}
