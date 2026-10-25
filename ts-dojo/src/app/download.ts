// Hands the viewer a file to save (§7 `:export`): a Blob URL clicked through a hidden
// `<a download>`. Nothing is fetched; the URL is revoked once the browser has taken the file.
export function downloadText(
  name: string,
  text: string,
  type = 'application/json',
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
